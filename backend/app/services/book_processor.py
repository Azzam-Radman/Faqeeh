"""Multi-format book ingestion pipeline for Islamic jurisprudence texts."""

from __future__ import annotations

import hashlib
import logging
import os
import re
import unicodedata
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Arabic chapter/section heading patterns
_CHAPTER_PATTERNS = [
    re.compile(r"^(?:كتاب|باب|فصل|مبحث|مسألة)\s+.+", re.MULTILINE),
    re.compile(r"^(?:الباب|الفصل|الكتاب|المبحث)\s+(?:الأول|الثاني|الثالث|الرابع|الخامس|السادس|السابع|الثامن|التاسع|العاشر)", re.MULTILINE),
]

_SECTION_PATTERNS = [
    re.compile(r"^(?:مسألة|فرع|تنبيه|فائدة|ملاحظة)\s*[::]?\s*.+", re.MULTILINE),
]


class BookProcessor:
    """Handles extraction, chunking, and storage of uploaded Islamic texts."""

    def __init__(self, kg_service: Any, vector_store: Any, config: Any) -> None:
        self.kg = kg_service
        self.vs = vector_store
        self.config = config
        self.max_chunk_size: int = getattr(config, "MAX_CHUNK_SIZE", 1000)
        self.chunk_overlap: int = getattr(config, "CHUNK_OVERLAP", 150)

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    def process_upload(
        self, file_path: str, filename: str, metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Detect format, extract text, chunk, and store in KG + vector store.

        Returns a dict with book_id, title, chunks_created.
        """
        ext = Path(filename).suffix.lower()

        if ext == ".pdf":
            raw_text = self._extract_pdf(file_path)
        elif ext == ".docx":
            raw_text = self._extract_docx(file_path)
        elif ext in {".txt", ".text"}:
            raw_text = self._extract_text(file_path)
        elif ext in {".md", ".markdown"}:
            with open(file_path, encoding="utf-8", errors="replace") as f:
                raw_text = f.read()
        else:
            raise ValueError(f"Unsupported file format: {ext}")

        if not raw_text.strip():
            raise ValueError("Extracted text is empty")

        # Convert to markdown for structural analysis
        md_text = self._convert_to_markdown(raw_text, metadata)

        # Detect book structure
        structure = self._detect_structure(md_text)

        # Generate / resolve book id
        title_ar = metadata.get("title_ar") or metadata.get("title") or Path(filename).stem
        author_id = metadata.get("author_id", "unknown")
        book_id = metadata.get("book_id") or self._generate_book_id(title_ar, author_id)

        # Ensure book exists in KG
        book_data = {
            "id": book_id,
            "title_ar": title_ar,
            "title_en": metadata.get("title_en"),
            "author_id": author_id,
            "edition": metadata.get("edition"),
            "publisher": metadata.get("publisher"),
            "year": metadata.get("year"),
            "total_volumes": metadata.get("total_volumes"),
            "description_ar": metadata.get("description_ar"),
        }
        self.kg.add_book(book_data)

        # Chunk
        chunks = self._chunk_text(md_text, {**metadata, "book_id": book_id, "structure": structure})

        # Store
        self._store_chunks(chunks, book_id, metadata)

        return {
            "book_id": book_id,
            "title": title_ar,
            "chunks_created": len(chunks),
        }

    # ------------------------------------------------------------------
    # Text extraction
    # ------------------------------------------------------------------

    def _extract_pdf(self, file_path: str) -> str:
        """Extract text from PDF using pdfplumber (handles Arabic RTL)."""
        try:
            import pdfplumber

            pages_text: List[str] = []
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    text = page.extract_text(x_tolerance=3, y_tolerance=3)
                    if text:
                        pages_text.append(text)
            return "\n\n".join(pages_text)
        except Exception as exc:
            logger.warning("pdfplumber failed (%s), trying PyMuPDF", exc)
            return self._extract_pdf_fitz(file_path)

    def _extract_pdf_fitz(self, file_path: str) -> str:
        """Fallback PDF extraction using PyMuPDF."""
        import fitz  # PyMuPDF

        pages_text: List[str] = []
        with fitz.open(file_path) as doc:
            for page in doc:
                text = page.get_text("text")
                if text:
                    pages_text.append(text)
        return "\n\n".join(pages_text)

    def _extract_docx(self, file_path: str) -> str:
        """Extract text from DOCX file."""
        from docx import Document

        doc = Document(file_path)
        paragraphs = [para.text for para in doc.paragraphs if para.text.strip()]
        return "\n\n".join(paragraphs)

    def _extract_text(self, file_path: str) -> str:
        """Read a plain-text file."""
        with open(file_path, encoding="utf-8", errors="replace") as f:
            return f.read()

    # ------------------------------------------------------------------
    # Text conversion & structure detection
    # ------------------------------------------------------------------

    def _convert_to_markdown(self, text: str, metadata: Dict[str, Any]) -> str:
        """Convert raw text to markdown, preserving heading structure."""
        lines = text.splitlines()
        md_lines: List[str] = []

        title_ar = metadata.get("title_ar", "")
        if title_ar:
            md_lines.append(f"# {title_ar}\n")

        for line in lines:
            stripped = line.strip()
            if not stripped:
                md_lines.append("")
                continue

            # Detect Arabic headings
            if any(pat.match(stripped) for pat in _CHAPTER_PATTERNS):
                md_lines.append(f"\n## {stripped}")
            elif any(pat.match(stripped) for pat in _SECTION_PATTERNS):
                md_lines.append(f"\n### {stripped}")
            else:
                md_lines.append(stripped)

        return "\n".join(md_lines)

    def _detect_structure(self, text: str) -> Dict[str, Any]:
        """Detect chapters and sections from markdown-formatted text."""
        chapters: List[Dict[str, Any]] = []
        lines = text.splitlines()

        current_chapter: Optional[Dict[str, Any]] = None
        chapter_count = 0

        for line in lines:
            stripped = line.strip()
            if stripped.startswith("## "):
                chapter_count += 1
                current_chapter = {
                    "title": stripped[3:].strip(),
                    "number": chapter_count,
                    "sections": [],
                }
                chapters.append(current_chapter)
            elif stripped.startswith("### ") and current_chapter:
                current_chapter["sections"].append({
                    "title": stripped[4:].strip(),
                    "number": len(current_chapter["sections"]) + 1,
                })

        return {"chapters": chapters, "total_chapters": len(chapters)}

    # ------------------------------------------------------------------
    # Chunking
    # ------------------------------------------------------------------

    def _chunk_text(
        self, text: str, metadata: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Split text into semantic chunks with overlap.

        Splits on double newlines first (paragraphs), then by size.
        """
        from app.utils.text_utils import extract_topic_keywords, clean_text

        book_id = metadata.get("book_id", "unknown")
        scholar_id = metadata.get("author_id", "unknown")

        # Split on double newlines (paragraphs)
        paragraphs = re.split(r"\n{2,}", text)
        paragraphs = [clean_text(p) for p in paragraphs if clean_text(p)]

        chunks: List[Dict[str, Any]] = []
        chunk_index = 0
        buffer = ""
        current_chapter: Optional[str] = None
        current_section: Optional[str] = None

        for para in paragraphs:
            # Detect heading changes
            if para.startswith("## "):
                current_chapter = para[3:].strip()
                current_section = None
                continue
            elif para.startswith("### "):
                current_section = para[4:].strip()
                continue
            elif para.startswith("# "):
                continue  # Skip title heading

            if len(buffer) + len(para) + 1 > self.max_chunk_size and buffer:
                # Flush current buffer
                chunk = self._make_chunk(
                    buffer, chunk_index, book_id, scholar_id,
                    current_chapter, current_section, metadata
                )
                chunks.append(chunk)
                chunk_index += 1
                # Overlap: keep last `chunk_overlap` chars as new buffer start
                buffer = buffer[-self.chunk_overlap:] + "\n" + para if self.chunk_overlap else para
            else:
                buffer = (buffer + "\n" + para).strip() if buffer else para

        # Flush remaining buffer
        if buffer.strip():
            chunk = self._make_chunk(
                buffer, chunk_index, book_id, scholar_id,
                current_chapter, current_section, metadata
            )
            chunks.append(chunk)

        # Handle oversized single paragraphs by splitting them
        final_chunks: List[Dict[str, Any]] = []
        for chunk in chunks:
            content = chunk["content"]
            if len(content) > self.max_chunk_size * 1.5:
                sub_chunks = self._split_large_chunk(
                    content, chunk_index, book_id, scholar_id,
                    chunk.get("chapter"), chunk.get("section"), metadata
                )
                final_chunks.extend(sub_chunks)
                chunk_index += len(sub_chunks)
            else:
                final_chunks.append(chunk)

        return final_chunks

    def _make_chunk(
        self,
        content: str,
        chunk_index: int,
        book_id: str,
        scholar_id: str,
        chapter: Optional[str],
        section: Optional[str],
        metadata: Dict[str, Any],
    ) -> Dict[str, Any]:
        from app.utils.text_utils import extract_topic_keywords

        chunk_id = self._generate_chunk_id(book_id, chunk_index, content)
        topic_tags = extract_topic_keywords(content)[:10]

        return {
            "id": chunk_id,
            "content": content,
            "book_id": book_id,
            "scholar_id": scholar_id,
            "chunk_index": chunk_index,
            "chapter": chapter,
            "section": section,
            "page": metadata.get("page"),
            "juz": metadata.get("juz"),
            "volume": metadata.get("volume"),
            "topic_tags": topic_tags,
        }

    def _split_large_chunk(
        self,
        content: str,
        start_index: int,
        book_id: str,
        scholar_id: str,
        chapter: Optional[str],
        section: Optional[str],
        metadata: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        """Split an oversized chunk by sentences or fixed size."""
        # Try splitting on Arabic sentence boundaries
        sentences = re.split(r"[.،؛]\s+", content)
        sub_chunks: List[Dict[str, Any]] = []
        buffer = ""
        idx = start_index

        for sent in sentences:
            if len(buffer) + len(sent) + 2 > self.max_chunk_size and buffer:
                sub_chunks.append(
                    self._make_chunk(buffer, idx, book_id, scholar_id, chapter, section, metadata)
                )
                idx += 1
                buffer = buffer[-self.chunk_overlap:] + " " + sent if self.chunk_overlap else sent
            else:
                buffer = (buffer + " " + sent).strip() if buffer else sent

        if buffer.strip():
            sub_chunks.append(
                self._make_chunk(buffer, idx, book_id, scholar_id, chapter, section, metadata)
            )

        return sub_chunks

    # ------------------------------------------------------------------
    # Storage
    # ------------------------------------------------------------------

    def _store_chunks(
        self, chunks: List[Dict[str, Any]], book_id: str, metadata: Dict[str, Any]
    ) -> None:
        """Store chunks in both the KG and the vector store."""
        chapter_id_cache: Dict[str, int] = {}
        section_id_cache: Dict[str, int] = {}

        kg_chunks: List[Dict[str, Any]] = []
        vs_docs: List[Dict[str, Any]] = []

        for chunk in chunks:
            chapter_title = chunk.get("chapter")
            section_title = chunk.get("section")
            chapter_id: Optional[int] = None
            section_id: Optional[int] = None

            if chapter_title:
                if chapter_title not in chapter_id_cache:
                    chapter_id_cache[chapter_title] = self.kg.add_chapter({
                        "book_id": book_id,
                        "title_ar": chapter_title,
                    })
                chapter_id = chapter_id_cache[chapter_title]

            if section_title:
                section_key = f"{chapter_title}::{section_title}"
                if section_key not in section_id_cache:
                    section_id_cache[section_key] = self.kg.add_section({
                        "book_id": book_id,
                        "chapter_id": chapter_id,
                        "title_ar": section_title,
                    })
                section_id = section_id_cache[section_key]

            kg_chunk = {
                "id": chunk["id"],
                "book_id": book_id,
                "scholar_id": chunk["scholar_id"],
                "chapter_id": chapter_id,
                "section_id": section_id,
                "content": chunk["content"],
                "page": chunk.get("page"),
                "juz": chunk.get("juz"),
                "volume": chunk.get("volume"),
                "chunk_index": chunk["chunk_index"],
                "topic_tags": chunk.get("topic_tags", []),
            }
            kg_chunks.append(kg_chunk)

            vs_doc = {
                "id": chunk["id"],
                "content": chunk["content"],
                "metadata": {
                    "book_id": book_id,
                    "scholar_id": chunk["scholar_id"],
                    "chapter": chapter_title or "",
                    "section": section_title or "",
                    "page": chunk.get("page") or 0,
                    "juz": chunk.get("juz") or 0,
                    "volume": chunk.get("volume") or 0,
                    "chunk_index": chunk["chunk_index"],
                },
            }
            vs_docs.append(vs_doc)

        # Batch insert into KG
        for kg_chunk in kg_chunks:
            self.kg.add_text_chunk(kg_chunk)

        # Batch insert into vector store
        if vs_docs:
            self.vs.add_documents(vs_docs)

        logger.info("Stored %d chunks for book %s", len(chunks), book_id)

    # ------------------------------------------------------------------
    # ID generation
    # ------------------------------------------------------------------

    @staticmethod
    def _generate_book_id(title: str, author: str) -> str:
        raw = f"{title}::{author}"
        return hashlib.md5(raw.encode("utf-8")).hexdigest()[:12]

    @staticmethod
    def _generate_chunk_id(book_id: str, chunk_index: int, content: str) -> str:
        raw = f"{book_id}::{chunk_index}::{content[:50]}"
        return hashlib.md5(raw.encode("utf-8")).hexdigest()
