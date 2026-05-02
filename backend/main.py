"""FastAPI application entry point for مساعد الفقيه."""

from __future__ import annotations

import logging
import os
import sys
from contextlib import asynccontextmanager
from typing import Any, Dict

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Ensure the backend directory is on the Python path when running directly
sys.path.insert(0, os.path.dirname(__file__))

from config import settings
from app.models.schemas import HealthResponse

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


# ------------------------------------------------------------------
# Lifespan
# ------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialise services on startup and clean up on shutdown."""
    logger.info("Starting up مساعد الفقيه backend…")

    # Ensure required directories exist
    settings.ensure_dirs()

    # 1. Knowledge Graph
    from app.services.knowledge_graph import KnowledgeGraph

    kg = KnowledgeGraph(db_path=settings.KG_DB_PATH)
    app.state.kg = kg

    # 2. Vector Store
    from app.services.vector_store import HybridVectorStore

    vector_store = HybridVectorStore(
        persist_dir=settings.CHROMA_PERSIST_DIR,
        model_name=settings.EMBEDDING_MODEL,
    )
    app.state.vector_store = vector_store

    # 3. LLM Service
    from app.services.llm_service import LLMService

    llm_service = LLMService(
        api_key=settings.OPENAI_API_KEY,
        model=settings.LLM_MODEL,
        base_url=settings.LLM_BASE_URL or None,
    )
    app.state.llm_service = llm_service

    # 4. Book Processor
    from app.services.book_processor import BookProcessor

    book_processor = BookProcessor(kg_service=kg, vector_store=vector_store, config=settings)
    app.state.book_processor = book_processor

    # 5. RAG Pipeline
    from app.services.rag_pipeline import RAGPipeline

    rag_pipeline = RAGPipeline(
        kg=kg,
        vector_store=vector_store,
        llm_service=llm_service,
        config=settings,
    )
    app.state.rag_pipeline = rag_pipeline
    app.state.settings = settings

    # 6. Seed data if KG is empty
    if kg.is_empty():
        logger.info("Knowledge graph is empty — seeding data…")
        data_dir = os.path.join(os.path.dirname(__file__), "data")
        kg.seed_data(data_dir=data_dir)

        # Load sample texts into vector store if available
        sample_path = os.path.join(data_dir, "sample_texts.json")
        if os.path.exists(sample_path):
            import json

            with open(sample_path, encoding="utf-8") as f:
                samples = json.load(f)

            vs_docs = []
            for chunk in samples:
                if not kg.chunk_exists(chunk["id"]):
                    kg.add_text_chunk(chunk)
                vs_docs.append({
                    "id": chunk["id"],
                    "content": chunk["content"],
                    "metadata": {
                        "book_id": chunk.get("book_id", ""),
                        "scholar_id": chunk.get("scholar_id", ""),
                        "chapter": chunk.get("chapter", ""),
                        "section": chunk.get("section", ""),
                        "page": chunk.get("page", 0) or 0,
                        "juz": chunk.get("juz", 0) or 0,
                        "volume": chunk.get("volume", 0) or 0,
                        "chunk_index": chunk.get("chunk_index", 0),
                    },
                })

            if vs_docs:
                vector_store.add_documents(vs_docs)
                logger.info("Seeded %d sample text chunks into vector store", len(vs_docs))

    logger.info(
        "Startup complete — %d scholars, %d vector docs",
        len(kg.get_all_scholars()),
        vector_store.count_documents(),
    )

    yield

    logger.info("Shutting down مساعد الفقيه backend…")


# ------------------------------------------------------------------
# App factory
# ------------------------------------------------------------------

app = FastAPI(
    title="مساعد الفقيه API",
    description="RAG system for Islamic jurisprudence — Fiqh Scholar Assistant",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — open for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------------
# Routers
# ------------------------------------------------------------------

from app.api.chat import router as chat_router
from app.api.books import router as books_router
from app.api.scholars import router as scholars_router

app.include_router(chat_router)
app.include_router(books_router)
app.include_router(scholars_router)


# ------------------------------------------------------------------
# Health check
# ------------------------------------------------------------------

@app.get("/health", response_model=HealthResponse, tags=["health"])
async def health() -> HealthResponse:
    """Health check endpoint."""
    services: Dict[str, Any] = {}

    try:
        scholar_count = len(app.state.kg.get_all_scholars())
        services["knowledge_graph"] = {"status": "ok", "scholars": scholar_count}
    except Exception as exc:
        services["knowledge_graph"] = {"status": "error", "detail": str(exc)}

    try:
        doc_count = app.state.vector_store.count_documents()
        services["vector_store"] = {"status": "ok", "documents": doc_count}
    except Exception as exc:
        services["vector_store"] = {"status": "error", "detail": str(exc)}

    services["llm"] = {
        "status": "ok" if settings.OPENAI_API_KEY else "no_key",
        "model": settings.LLM_MODEL,
    }

    overall = "ok" if all(v.get("status") == "ok" for v in services.values()) else "degraded"

    return HealthResponse(status=overall, version="1.0.0", services=services)


# ------------------------------------------------------------------
# Entry point
# ------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
