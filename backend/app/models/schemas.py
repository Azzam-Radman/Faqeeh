from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, Field


class Scholar(BaseModel):
    id: str
    name_ar: str
    name_en: Optional[str] = None
    madhab: str  # hanafi | maliki | shafii | hanbali
    birth_year: Optional[int] = None
    death_year: Optional[int] = None
    era: Optional[str] = None
    description_ar: Optional[str] = None
    description_en: Optional[str] = None


class Book(BaseModel):
    id: str
    title_ar: str
    title_en: Optional[str] = None
    author_id: str
    author_name: Optional[str] = None
    edition: Optional[str] = None
    publisher: Optional[str] = None
    year: Optional[int] = None
    total_volumes: Optional[int] = None
    description_ar: Optional[str] = None


class Reference(BaseModel):
    scholar_name: Optional[str] = None
    madhab: Optional[str] = None
    book_title: Optional[str] = None
    juz: Optional[int] = None
    volume: Optional[int] = None
    page: Optional[int] = None
    section: Optional[str] = None
    chapter: Optional[str] = None
    edition: Optional[str] = None
    publisher: Optional[str] = None
    text_excerpt: Optional[str] = None
    chunk_id: Optional[str] = None


class ScholarComparison(BaseModel):
    madhab: str
    scholar_name: str
    position: str
    evidence: Optional[str] = None
    references: List[Reference] = Field(default_factory=list)


class ChatMessage(BaseModel):
    role: str  # user | assistant
    content: str
    references: List[Reference] = Field(default_factory=list)
    scholars_comparison: List[ScholarComparison] = Field(default_factory=list)
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ChatRequest(BaseModel):
    query: str
    conversation_id: Optional[str] = None
    language: Optional[str] = None  # 'ar' | 'en' — auto-detected if None
    stream: bool = False


class ChatResponse(BaseModel):
    answer: str
    references: List[Reference] = Field(default_factory=list)
    scholars_comparison: List[ScholarComparison] = Field(default_factory=list)
    summary: Optional[str] = None
    language: str = "ar"
    sources_count: int = 0


class BookUploadResponse(BaseModel):
    success: bool
    book_id: str
    title: str
    chunks_created: int
    message: str


class BookListResponse(BaseModel):
    books: List[Book]
    total: int


class ScholarListResponse(BaseModel):
    scholars: List[Scholar]
    total: int


class ChunkInfo(BaseModel):
    id: str
    content: str
    page: Optional[int] = None
    juz: Optional[int] = None
    volume: Optional[int] = None
    chapter: Optional[str] = None
    section: Optional[str] = None
    topic_tags: List[str] = Field(default_factory=list)


class BookChunksResponse(BaseModel):
    book_id: str
    chunks: List[ChunkInfo]
    total: int


class HealthResponse(BaseModel):
    status: str
    version: str
    services: dict[str, Any]
