"""Chat API endpoints for مساعد الفقيه."""

from __future__ import annotations

import json
import logging
import os
import sqlite3
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from app.models.schemas import ChatMessage, ChatRequest, ChatResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])

# In-memory conversation storage: conversation_id -> List[ChatMessage]
_conversations: Dict[str, List[ChatMessage]] = {}
_DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "conversations.db")


def _init_store() -> None:
    with sqlite3.connect(_DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS conversation_messages (
                conversation_id TEXT NOT NULL,
                role TEXT NOT NULL,
                payload TEXT NOT NULL,
                timestamp TEXT NOT NULL
            )
            """
        )


def _save_message(conversation_id: str, message: ChatMessage) -> None:
    with sqlite3.connect(_DB_PATH) as conn:
        conn.execute(
            "INSERT INTO conversation_messages (conversation_id, role, payload, timestamp) VALUES (?, ?, ?, ?)",
            (conversation_id, message.role, json.dumps(message.model_dump(), ensure_ascii=False), message.timestamp.isoformat()),
        )


def _load_messages(conversation_id: str) -> List[ChatMessage]:
    with sqlite3.connect(_DB_PATH) as conn:
        rows = conn.execute(
            "SELECT payload FROM conversation_messages WHERE conversation_id = ? ORDER BY timestamp ASC",
            (conversation_id,),
        ).fetchall()
    result: List[ChatMessage] = []
    for (payload,) in rows:
        try:
            result.append(ChatMessage(**json.loads(payload)))
        except Exception:
            continue
    return result


_init_store()


def _get_pipeline(request: Request) -> Any:
    return request.app.state.rag_pipeline


# ------------------------------------------------------------------
# SSE helper
# ------------------------------------------------------------------

async def _sse_stream(query: str, conversation_id: str, request: Request):
    """Generate SSE events from the streaming RAG pipeline."""
    pipeline = _get_pipeline(request)
    language = request.app.state.config.get("language", "ar") if hasattr(request.app.state, "config") else "ar"

    from app.utils.text_utils import detect_language as dl
    language = dl(query)

    chat_request = ChatRequest(
        query=query,
        conversation_id=conversation_id,
        language=language,
        stream=True,
    )

    full_text = ""
    try:
        async for chunk in pipeline.stream_query(chat_request):
            full_text += chunk
            data = json.dumps({"type": "text", "content": chunk}, ensure_ascii=False)
            yield f"data: {data}\n\n"
    except Exception as exc:
        logger.error("Streaming error: %s", exc)
        error_data = json.dumps({"type": "error", "content": str(exc)}, ensure_ascii=False)
        yield f"data: {error_data}\n\n"
        return

    # Store assistant message in conversation history
    if conversation_id:
        assistant_msg = ChatMessage(role="assistant", content=full_text, timestamp=datetime.utcnow())
        _conversations.setdefault(conversation_id, _load_messages(conversation_id)).append(assistant_msg)
        _save_message(conversation_id, assistant_msg)

    done_data = json.dumps({"type": "done"}, ensure_ascii=False)
    yield f"data: {done_data}\n\n"


# ------------------------------------------------------------------
# Endpoints
# ------------------------------------------------------------------

@router.post("", response_model=None)
async def chat_streaming(body: ChatRequest, request: Request):
    """Streaming chat endpoint using Server-Sent Events."""
    query = body.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    conversation_id = body.conversation_id or str(uuid.uuid4())

    # Store user message
    user_msg = ChatMessage(role="user", content=query, timestamp=datetime.utcnow())
    _conversations.setdefault(conversation_id, _load_messages(conversation_id)).append(user_msg)
    _save_message(conversation_id, user_msg)

    if body.stream:
        return StreamingResponse(
            _sse_stream(query, conversation_id, request),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
                "X-Conversation-Id": conversation_id,
            },
        )

    # Non-streaming fallback via this endpoint
    pipeline = _get_pipeline(request)
    from app.utils.text_utils import detect_language as dl

    language = body.language or dl(query)
    chat_request = ChatRequest(
        query=query,
        conversation_id=conversation_id,
        language=language,
        stream=False,
    )
    response: ChatResponse = await pipeline.query(chat_request)

    assistant_msg = ChatMessage(
        role="assistant",
        content=response.answer,
        references=response.references,
        scholars_comparison=response.scholars_comparison,
        timestamp=datetime.utcnow(),
    )
    _conversations[conversation_id].append(assistant_msg)
    _save_message(conversation_id, assistant_msg)

    return response


@router.post("/sync", response_model=ChatResponse)
async def chat_sync(body: ChatRequest, request: Request):
    """Non-streaming synchronous chat endpoint."""
    query = body.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    conversation_id = body.conversation_id or str(uuid.uuid4())

    user_msg = ChatMessage(role="user", content=query, timestamp=datetime.utcnow())
    _conversations.setdefault(conversation_id, _load_messages(conversation_id)).append(user_msg)
    _save_message(conversation_id, user_msg)

    pipeline = _get_pipeline(request)
    from app.utils.text_utils import detect_language as dl

    language = body.language or dl(query)
    chat_request = ChatRequest(
        query=query,
        conversation_id=conversation_id,
        language=language,
        stream=False,
    )
    response: ChatResponse = await pipeline.query(chat_request)

    assistant_msg = ChatMessage(
        role="assistant",
        content=response.answer,
        references=response.references,
        scholars_comparison=response.scholars_comparison,
        timestamp=datetime.utcnow(),
    )
    _conversations[conversation_id].append(assistant_msg)
    _save_message(conversation_id, assistant_msg)

    return response


@router.get("/{conversation_id}/history")
async def get_history(conversation_id: str) -> Dict[str, Any]:
    """Return conversation message history."""
    messages = _conversations.get(conversation_id, _load_messages(conversation_id))
    return {
        "conversation_id": conversation_id,
        "messages": [m.dict() for m in messages],
        "total": len(messages),
    }


@router.delete("/{conversation_id}")
async def clear_conversation(conversation_id: str) -> Dict[str, str]:
    """Clear conversation history for a given ID."""
    if conversation_id in _conversations:
        del _conversations[conversation_id]
    with sqlite3.connect(_DB_PATH) as conn:
        conn.execute("DELETE FROM conversation_messages WHERE conversation_id = ?", (conversation_id,))
    return {"status": "ok", "conversation_id": conversation_id}
