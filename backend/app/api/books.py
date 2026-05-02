"""Books API endpoints for مساعد الفقيه."""

from __future__ import annotations

import logging
import os
import uuid
from typing import Any, Dict, List, Optional

import aiofiles
from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile

from app.models.schemas import (
    Book,
    BookChunksResponse,
    BookListResponse,
    BookUploadResponse,
    ChunkInfo,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/books", tags=["books"])


def _get_services(request: Request):
    return (
        request.app.state.kg,
        request.app.state.vector_store,
        request.app.state.book_processor,
        request.app.state.settings,
    )


# ------------------------------------------------------------------
# Endpoints
# ------------------------------------------------------------------

@router.get("", response_model=BookListResponse)
async def list_books(request: Request) -> BookListResponse:
    """Return all books with metadata."""
    kg, *_ = _get_services(request)
    books = kg.get_all_books()
    return BookListResponse(books=books, total=len(books))


@router.post("/upload", response_model=BookUploadResponse)
async def upload_book(
    request: Request,
    file: UploadFile = File(...),
    title_ar: Optional[str] = Form(None),
    title_en: Optional[str] = Form(None),
    title_arabic: Optional[str] = Form(None),
    title_english: Optional[str] = Form(None),
    author_id: Optional[str] = Form(None),
    author_arabic: Optional[str] = Form(None),
    author_english: Optional[str] = Form(None),
    edition: Optional[str] = Form(None),
    publisher: Optional[str] = Form(None),
    year: Optional[int] = Form(None),
    total_volumes: Optional[int] = Form(None),
    description_ar: Optional[str] = Form(None),
) -> BookUploadResponse:
    """Upload and process a book file (PDF, DOCX, or TXT)."""
    kg, vector_store, book_processor, settings = _get_services(request)

    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    allowed_extensions = {".pdf", ".docx", ".txt", ".text", ".md", ".markdown"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Allowed: {', '.join(allowed_extensions)}",
        )

    # Save uploaded file
    upload_dir = settings.UPLOAD_DIR
    os.makedirs(upload_dir, exist_ok=True)
    safe_filename = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(upload_dir, safe_filename)

    try:
        async with aiofiles.open(file_path, "wb") as out_file:
            content = await file.read()
            await out_file.write(content)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {exc}")

    resolved_author_id = author_id or "abu_hanifa"
    metadata = {
        "title_ar": title_ar or title_arabic or os.path.splitext(file.filename)[0],
        "title_en": title_en or title_english,
        "author_id": resolved_author_id,
        "author_arabic": author_arabic,
        "author_english": author_english,
        "edition": edition,
        "publisher": publisher,
        "year": year,
        "total_volumes": total_volumes,
        "description_ar": description_ar,
    }

    try:
        result = book_processor.process_upload(file_path, file.filename, metadata)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.exception("Book processing failed")
        raise HTTPException(status_code=500, detail=f"Processing error: {exc}")
    finally:
        # Clean up temp file
        try:
            os.remove(file_path)
        except OSError:
            pass

    return BookUploadResponse(
        success=True,
        book_id=result["book_id"],
        title=result["title"],
        chunks_created=result["chunks_created"],
        message=f"تم تحميل الكتاب بنجاح مع {result['chunks_created']} مقطع نصي",
    )


@router.delete("/{book_id}")
async def delete_book(book_id: str, request: Request) -> Dict[str, Any]:
    """Remove a book from KG and vector store."""
    kg, vector_store, *_ = _get_services(request)

    try:
        kg.delete_book(book_id)
        vector_store.delete_by_book(book_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to delete book: {exc}")

    return {"status": "ok", "book_id": book_id, "message": "تم حذف الكتاب بنجاح"}


@router.get("/{book_id}/chunks", response_model=BookChunksResponse)
async def get_book_chunks(book_id: str, request: Request) -> BookChunksResponse:
    """List all chunks for a book."""
    import json

    kg, *_ = _get_services(request)
    raw_chunks = kg.get_chunks_by_book(book_id)

    chunks: List[ChunkInfo] = []
    for c in raw_chunks:
        tags = c.get("topic_tags", "[]")
        if isinstance(tags, str):
            try:
                tags = json.loads(tags)
            except Exception:
                tags = []
        chunks.append(ChunkInfo(
            id=c["id"],
            content=c["content"],
            page=c.get("page"),
            juz=c.get("juz"),
            volume=c.get("volume"),
            chapter=c.get("chapter_title"),
            section=c.get("section_title"),
            topic_tags=tags,
        ))

    return BookChunksResponse(book_id=book_id, chunks=chunks, total=len(chunks))
