"""SQLite-based Knowledge Graph for Islamic jurisprudence data."""

from __future__ import annotations

import json
import logging
import os
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.models.schemas import Book, Reference, Scholar
from app.utils.text_utils import normalize_arabic, arabic_tokenize

logger = logging.getLogger(__name__)


class KnowledgeGraph:
    """Manages the SQLite knowledge graph for scholars, books, chapters, and text chunks."""

    def __init__(self, db_path: str) -> None:
        self.db_path = db_path
        os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
        self._init_db()

    # ------------------------------------------------------------------
    # Initialisation
    # ------------------------------------------------------------------

    def _init_db(self) -> None:
        """Create all tables if they do not exist."""
        with self._connect() as conn:
            conn.executescript("""
                PRAGMA journal_mode=WAL;
                PRAGMA foreign_keys=ON;

                CREATE TABLE IF NOT EXISTS scholars (
                    id          TEXT PRIMARY KEY,
                    name_ar     TEXT NOT NULL,
                    name_en     TEXT,
                    madhab      TEXT NOT NULL,
                    birth_year  INTEGER,
                    death_year  INTEGER,
                    era         TEXT,
                    description_ar TEXT,
                    description_en TEXT
                );

                CREATE TABLE IF NOT EXISTS books (
                    id              TEXT PRIMARY KEY,
                    title_ar        TEXT NOT NULL,
                    title_en        TEXT,
                    author_id       TEXT NOT NULL,
                    edition         TEXT,
                    publisher       TEXT,
                    year            INTEGER,
                    total_volumes   INTEGER,
                    description_ar  TEXT,
                    FOREIGN KEY (author_id) REFERENCES scholars(id)
                );

                CREATE TABLE IF NOT EXISTS chapters (
                    id       INTEGER PRIMARY KEY AUTOINCREMENT,
                    book_id  TEXT NOT NULL,
                    title_ar TEXT NOT NULL,
                    number   INTEGER,
                    FOREIGN KEY (book_id) REFERENCES books(id)
                );

                CREATE TABLE IF NOT EXISTS sections (
                    id         INTEGER PRIMARY KEY AUTOINCREMENT,
                    chapter_id INTEGER,
                    book_id    TEXT NOT NULL,
                    title_ar   TEXT NOT NULL,
                    number     INTEGER,
                    FOREIGN KEY (chapter_id) REFERENCES chapters(id),
                    FOREIGN KEY (book_id) REFERENCES books(id)
                );

                CREATE TABLE IF NOT EXISTS text_chunks (
                    id          TEXT PRIMARY KEY,
                    section_id  INTEGER,
                    chapter_id  INTEGER,
                    book_id     TEXT NOT NULL,
                    scholar_id  TEXT NOT NULL,
                    content     TEXT NOT NULL,
                    page        INTEGER,
                    juz         INTEGER,
                    volume      INTEGER,
                    chunk_index INTEGER DEFAULT 0,
                    topic_tags  TEXT DEFAULT '[]',
                    FOREIGN KEY (book_id) REFERENCES books(id),
                    FOREIGN KEY (scholar_id) REFERENCES scholars(id)
                );

                CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts
                    USING fts5(
                        id UNINDEXED,
                        content,
                        tokenize='unicode61'
                    );

                CREATE INDEX IF NOT EXISTS idx_chunks_book   ON text_chunks(book_id);
                CREATE INDEX IF NOT EXISTS idx_chunks_scholar ON text_chunks(scholar_id);
                CREATE INDEX IF NOT EXISTS idx_books_author  ON books(author_id);
            """)

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    # ------------------------------------------------------------------
    # Seed data
    # ------------------------------------------------------------------

    def seed_data(self, data_dir: str = "./data") -> None:
        """Load scholars.json and books.json into the DB if tables are empty."""
        scholars_path = os.path.join(data_dir, "scholars.json")
        books_path = os.path.join(data_dir, "books.json")

        if os.path.exists(scholars_path):
            with open(scholars_path, encoding="utf-8") as f:
                scholars = json.load(f)
            for s in scholars:
                self.add_scholar(s)
            logger.info("Seeded %d scholars", len(scholars))

        if os.path.exists(books_path):
            with open(books_path, encoding="utf-8") as f:
                books = json.load(f)
            for b in books:
                self.add_book(b)
            logger.info("Seeded %d books", len(books))

    # ------------------------------------------------------------------
    # Insertion helpers
    # ------------------------------------------------------------------

    def add_scholar(self, data: Dict[str, Any]) -> None:
        sql = """
            INSERT OR IGNORE INTO scholars
                (id, name_ar, name_en, madhab, birth_year, death_year, era, description_ar, description_en)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        with self._connect() as conn:
            conn.execute(sql, (
                data["id"],
                data["name_ar"],
                data.get("name_en"),
                data["madhab"],
                data.get("birth_year"),
                data.get("death_year"),
                data.get("era"),
                data.get("description_ar"),
                data.get("description_en"),
            ))

    def add_book(self, data: Dict[str, Any]) -> None:
        sql = """
            INSERT OR IGNORE INTO books
                (id, title_ar, title_en, author_id, edition, publisher, year, total_volumes, description_ar)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        with self._connect() as conn:
            conn.execute(sql, (
                data["id"],
                data["title_ar"],
                data.get("title_en"),
                data["author_id"],
                data.get("edition"),
                data.get("publisher"),
                data.get("year"),
                data.get("total_volumes"),
                data.get("description_ar"),
            ))

    def add_chapter(self, data: Dict[str, Any]) -> int:
        sql = """
            INSERT INTO chapters (book_id, title_ar, number)
            VALUES (?, ?, ?)
        """
        with self._connect() as conn:
            cur = conn.execute(sql, (
                data["book_id"],
                data["title_ar"],
                data.get("number"),
            ))
            return cur.lastrowid

    def add_section(self, data: Dict[str, Any]) -> int:
        sql = """
            INSERT INTO sections (chapter_id, book_id, title_ar, number)
            VALUES (?, ?, ?, ?)
        """
        with self._connect() as conn:
            cur = conn.execute(sql, (
                data.get("chapter_id"),
                data["book_id"],
                data["title_ar"],
                data.get("number"),
            ))
            return cur.lastrowid

    def add_text_chunk(self, data: Dict[str, Any]) -> None:
        """Insert a text chunk and update the FTS index."""
        topic_tags = json.dumps(data.get("topic_tags", []), ensure_ascii=False)
        sql = """
            INSERT OR REPLACE INTO text_chunks
                (id, section_id, chapter_id, book_id, scholar_id, content,
                 page, juz, volume, chunk_index, topic_tags)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        fts_sql = """
            INSERT OR REPLACE INTO chunks_fts (id, content)
            VALUES (?, ?)
        """
        normalised_content = normalize_arabic(data["content"])
        with self._connect() as conn:
            conn.execute(sql, (
                data["id"],
                data.get("section_id"),
                data.get("chapter_id"),
                data["book_id"],
                data["scholar_id"],
                data["content"],
                data.get("page"),
                data.get("juz"),
                data.get("volume"),
                data.get("chunk_index", 0),
                topic_tags,
            ))
            conn.execute(fts_sql, (data["id"], normalised_content))

    # ------------------------------------------------------------------
    # Search methods
    # ------------------------------------------------------------------

    def search_by_keyword(self, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Full-text search using FTS5 on normalised Arabic text."""
        normalised = normalize_arabic(query)
        tokens = arabic_tokenize(normalised)
        if not tokens:
            return []

        # Build FTS query: all tokens joined with OR for broader recall
        fts_query = " OR ".join(f'"{t}"' for t in tokens[:10])

        sql = """
            SELECT tc.*, s.name_ar AS scholar_name, s.madhab,
                   b.title_ar AS book_title, b.edition, b.publisher,
                   ch.title_ar AS chapter_title, sec.title_ar AS section_title
            FROM chunks_fts fts
            JOIN text_chunks tc ON tc.id = fts.id
            JOIN scholars s ON s.id = tc.scholar_id
            JOIN books b ON b.id = tc.book_id
            LEFT JOIN chapters ch ON ch.id = tc.chapter_id
            LEFT JOIN sections sec ON sec.id = tc.section_id
            WHERE chunks_fts MATCH ?
            ORDER BY rank
            LIMIT ?
        """
        with self._connect() as conn:
            rows = conn.execute(sql, (fts_query, limit)).fetchall()
        return [dict(r) for r in rows]

    def search_by_scholar(
        self,
        scholar_id_or_name: str,
        topic_keywords: Optional[List[str]] = None,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """Return chunks filtered by scholar id or name."""
        with self._connect() as conn:
            # Try by ID first
            scholar = conn.execute(
                "SELECT id FROM scholars WHERE id = ?", (scholar_id_or_name,)
            ).fetchone()
            if not scholar:
                # Try by partial name match
                scholar = conn.execute(
                    "SELECT id FROM scholars WHERE name_ar LIKE ?",
                    (f"%{scholar_id_or_name}%",),
                ).fetchone()
            if not scholar:
                return []
            scholar_id = scholar["id"]

        if topic_keywords:
            results = []
            for kw in topic_keywords[:5]:
                partial = self.search_by_keyword(kw, limit=limit)
                for r in partial:
                    if r.get("scholar_id") == scholar_id:
                        results.append(r)
            # Deduplicate
            seen: set = set()
            deduped = []
            for r in results:
                if r["id"] not in seen:
                    seen.add(r["id"])
                    deduped.append(r)
            return deduped[:limit]

        sql = """
            SELECT tc.*, s.name_ar AS scholar_name, s.madhab,
                   b.title_ar AS book_title, b.edition, b.publisher,
                   ch.title_ar AS chapter_title, sec.title_ar AS section_title
            FROM text_chunks tc
            JOIN scholars s ON s.id = tc.scholar_id
            JOIN books b ON b.id = tc.book_id
            LEFT JOIN chapters ch ON ch.id = tc.chapter_id
            LEFT JOIN sections sec ON sec.id = tc.section_id
            WHERE tc.scholar_id = ?
            LIMIT ?
        """
        with self._connect() as conn:
            rows = conn.execute(sql, (scholar_id, limit)).fetchall()
        return [dict(r) for r in rows]

    def search_by_madhab(
        self, madhab: str, topic_keywords: List[str], limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Return chunks for a specific madhab filtered by topic keywords."""
        results = []
        for kw in topic_keywords[:5]:
            partial = self.search_by_keyword(kw, limit=limit)
            for r in partial:
                if r.get("madhab") == madhab:
                    results.append(r)
        seen: set = set()
        deduped = []
        for r in results:
            if r["id"] not in seen:
                seen.add(r["id"])
                deduped.append(r)
        return deduped[:limit]

    def get_reference_for_chunk(self, chunk_id: str) -> Optional[Reference]:
        """Build a full Reference object for a given chunk id."""
        sql = """
            SELECT tc.*, s.name_ar AS scholar_name, s.madhab,
                   b.title_ar AS book_title, b.edition, b.publisher,
                   ch.title_ar AS chapter_title, sec.title_ar AS section_title
            FROM text_chunks tc
            JOIN scholars s ON s.id = tc.scholar_id
            JOIN books b ON b.id = tc.book_id
            LEFT JOIN chapters ch ON ch.id = tc.chapter_id
            LEFT JOIN sections sec ON sec.id = tc.section_id
            WHERE tc.id = ?
        """
        with self._connect() as conn:
            row = conn.execute(sql, (chunk_id,)).fetchone()
        if not row:
            return None
        r = dict(row)
        return Reference(
            scholar_name=r.get("scholar_name"),
            madhab=r.get("madhab"),
            book_title=r.get("book_title"),
            juz=r.get("juz"),
            volume=r.get("volume"),
            page=r.get("page"),
            section=r.get("section_title"),
            chapter=r.get("chapter_title"),
            edition=r.get("edition"),
            publisher=r.get("publisher"),
            text_excerpt=r.get("content", "")[:200],
            chunk_id=chunk_id,
        )

    # ------------------------------------------------------------------
    # Listing helpers
    # ------------------------------------------------------------------

    def get_all_scholars(self) -> List[Scholar]:
        sql = "SELECT * FROM scholars ORDER BY death_year"
        with self._connect() as conn:
            rows = conn.execute(sql).fetchall()
        return [Scholar(**dict(r)) for r in rows]

    def get_all_books(self) -> List[Book]:
        sql = """
            SELECT b.*, s.name_ar AS author_name
            FROM books b
            JOIN scholars s ON s.id = b.author_id
            ORDER BY b.title_ar
        """
        with self._connect() as conn:
            rows = conn.execute(sql).fetchall()
        return [Book(**dict(r)) for r in rows]

    def get_books_by_scholar(self, scholar_id: str) -> List[Book]:
        sql = """
            SELECT b.*, s.name_ar AS author_name
            FROM books b
            JOIN scholars s ON s.id = b.author_id
            WHERE b.author_id = ?
        """
        with self._connect() as conn:
            rows = conn.execute(sql, (scholar_id,)).fetchall()
        return [Book(**dict(r)) for r in rows]

    def get_chunks_by_book(self, book_id: str) -> List[Dict[str, Any]]:
        sql = """
            SELECT tc.*, ch.title_ar AS chapter_title, sec.title_ar AS section_title
            FROM text_chunks tc
            LEFT JOIN chapters ch ON ch.id = tc.chapter_id
            LEFT JOIN sections sec ON sec.id = tc.section_id
            WHERE tc.book_id = ?
            ORDER BY tc.chunk_index
        """
        with self._connect() as conn:
            rows = conn.execute(sql, (book_id,)).fetchall()
        return [dict(r) for r in rows]

    def delete_book(self, book_id: str) -> None:
        """Remove a book and all its chunks from the KG."""
        with self._connect() as conn:
            # Delete from FTS first
            chunk_ids = [
                r["id"]
                for r in conn.execute(
                    "SELECT id FROM text_chunks WHERE book_id = ?", (book_id,)
                ).fetchall()
            ]
            for cid in chunk_ids:
                conn.execute("DELETE FROM chunks_fts WHERE id = ?", (cid,))
            conn.execute("DELETE FROM text_chunks WHERE book_id = ?", (book_id,))
            conn.execute("DELETE FROM sections WHERE book_id = ?", (book_id,))
            conn.execute("DELETE FROM chapters WHERE book_id = ?", (book_id,))
            conn.execute("DELETE FROM books WHERE id = ?", (book_id,))

    def is_empty(self) -> bool:
        """Return True if no scholars have been loaded."""
        with self._connect() as conn:
            count = conn.execute("SELECT COUNT(*) FROM scholars").fetchone()[0]
        return count == 0

    def chunk_exists(self, chunk_id: str) -> bool:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT 1 FROM text_chunks WHERE id = ?", (chunk_id,)
            ).fetchone()
        return row is not None
