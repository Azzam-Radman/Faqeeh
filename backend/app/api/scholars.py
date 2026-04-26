"""Scholars API endpoints for مساعد الفقيه."""

from __future__ import annotations

import logging
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, Request

from app.models.schemas import Scholar, ScholarListResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/scholars", tags=["scholars"])


def _get_kg(request: Request) -> Any:
    return request.app.state.kg


@router.get("", response_model=ScholarListResponse)
async def list_scholars(request: Request) -> ScholarListResponse:
    """Return all scholars with their books."""
    kg = _get_kg(request)
    scholars = kg.get_all_scholars()
    return ScholarListResponse(scholars=scholars, total=len(scholars))


@router.get("/{scholar_id}")
async def get_scholar(scholar_id: str, request: Request) -> Dict[str, Any]:
    """Return scholar details along with their books."""
    kg = _get_kg(request)
    scholars = kg.get_all_scholars()
    scholar = next((s for s in scholars if s.id == scholar_id), None)
    if not scholar:
        raise HTTPException(status_code=404, detail=f"Scholar not found: {scholar_id}")

    books = kg.get_books_by_scholar(scholar_id)

    return {
        "scholar": scholar.dict(),
        "books": [b.dict() for b in books],
        "total_books": len(books),
    }
