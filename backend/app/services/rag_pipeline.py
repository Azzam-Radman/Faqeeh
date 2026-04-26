"""Main RAG orchestrator for مساعد الفقيه."""

from __future__ import annotations

import asyncio
import logging
from typing import Any, AsyncGenerator, Dict, List, Optional

from app.models.schemas import (
    ChatRequest,
    ChatResponse,
    Reference,
    ScholarComparison,
)
from app.utils.text_utils import detect_language, extract_scholar_mentions, extract_topic_keywords

logger = logging.getLogger(__name__)


class RAGPipeline:
    """Orchestrates retrieval, re-ranking, and LLM generation."""

    def __init__(
        self,
        kg: Any,
        vector_store: Any,
        llm_service: Any,
        config: Any,
    ) -> None:
        self.kg = kg
        self.vs = vector_store
        self.llm = llm_service
        self.config = config
        self.max_context_chunks: int = getattr(config, "MAX_CONTEXT_CHUNKS", 8)

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    async def query(self, request: ChatRequest) -> ChatResponse:
        """Full RAG pipeline: retrieve → re-rank → generate."""
        # 1. Language detection
        language = request.language or detect_language(request.query)

        # 2. Extract scholar mentions and topic keywords
        all_scholars = self.kg.get_all_scholars()
        scholars_dicts = [s.dict() for s in all_scholars]
        scholar_mentions = extract_scholar_mentions(request.query, scholars_dicts)
        topic_keywords = extract_topic_keywords(request.query)

        # 3. Parallel retrieval: KG keyword search + vector hybrid search
        kg_results, vector_results = await asyncio.gather(
            self._kg_search(request.query, scholar_mentions, topic_keywords),
            self._vector_search(request.query, scholar_mentions),
        )

        # 4. Merge and deduplicate results
        merged = self._merge_results(kg_results, vector_results)

        # 5. Re-rank
        reranked = self._rerank(merged, scholar_mentions, topic_keywords)

        # 6. Build context (top N chunks)
        context_chunks = reranked[: self.max_context_chunks]

        # Enrich with KG metadata
        enriched = self._enrich_with_kg(context_chunks)

        # 7. Call LLM
        llm_result = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: self.llm.generate(request.query, enriched, language),
        )

        # 8. Build references
        references = self._build_references(enriched)

        # 9. Build scholars comparison table
        comparison = self._build_comparison_table(references, llm_result.get("scholars_comparison", []))

        return ChatResponse(
            answer=llm_result.get("answer", ""),
            references=references,
            scholars_comparison=comparison,
            summary=llm_result.get("summary"),
            language=language,
            sources_count=len(enriched),
        )

    async def stream_query(
        self, request: ChatRequest
    ) -> AsyncGenerator[str, None]:
        """Streaming RAG pipeline — yields SSE-formatted text chunks."""
        language = request.language or detect_language(request.query)

        all_scholars = self.kg.get_all_scholars()
        scholars_dicts = [s.dict() for s in all_scholars]
        scholar_mentions = extract_scholar_mentions(request.query, scholars_dicts)
        topic_keywords = extract_topic_keywords(request.query)

        kg_results, vector_results = await asyncio.gather(
            self._kg_search(request.query, scholar_mentions, topic_keywords),
            self._vector_search(request.query, scholar_mentions),
        )

        merged = self._merge_results(kg_results, vector_results)
        reranked = self._rerank(merged, scholar_mentions, topic_keywords)
        context_chunks = reranked[: self.max_context_chunks]
        enriched = self._enrich_with_kg(context_chunks)

        async for text_chunk in self.llm.stream_generate(request.query, enriched, language):
            yield text_chunk

    # ------------------------------------------------------------------
    # Retrieval helpers
    # ------------------------------------------------------------------

    async def _kg_search(
        self,
        query: str,
        scholar_mentions: List[Dict[str, Any]],
        topic_keywords: List[str],
    ) -> List[Dict[str, Any]]:
        """Run KG search in a thread pool."""
        loop = asyncio.get_event_loop()

        def _run():
            results: List[Dict[str, Any]] = []

            # By keyword
            kw_results = self.kg.search_by_keyword(query, limit=15)
            results.extend(kw_results)

            # By specific scholars mentioned
            for scholar in scholar_mentions:
                sr = self.kg.search_by_scholar(
                    scholar["id"], topic_keywords=topic_keywords, limit=10
                )
                results.extend(sr)

            return results

        return await loop.run_in_executor(None, _run)

    async def _vector_search(
        self,
        query: str,
        scholar_mentions: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Run hybrid vector search in a thread pool."""
        loop = asyncio.get_event_loop()

        def _run():
            filter_meta = None
            if len(scholar_mentions) == 1:
                filter_meta = {"scholar_id": scholar_mentions[0]["id"]}

            return self.vs.hybrid_search(query, k=15, filter_metadata=filter_meta)

        return await loop.run_in_executor(None, _run)

    # ------------------------------------------------------------------
    # Merging & re-ranking
    # ------------------------------------------------------------------

    def _merge_results(
        self,
        kg_results: List[Dict[str, Any]],
        vector_results: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Deduplicate and merge KG metadata into vector results."""
        seen: Dict[str, Dict[str, Any]] = {}

        # Index KG results by id
        for item in kg_results:
            cid = item.get("id", "")
            if cid and cid not in seen:
                seen[cid] = item

        # Merge vector results, enriching with KG data where available
        for item in vector_results:
            cid = item.get("id", "")
            if not cid:
                continue
            if cid in seen:
                # Merge vector scores into existing KG item
                seen[cid]["rrf_score"] = item.get("rrf_score", 0.0)
                seen[cid]["dense_score"] = item.get("dense_score", 0.0)
            else:
                seen[cid] = item

        return list(seen.values())

    def _rerank(
        self,
        chunks: List[Dict[str, Any]],
        scholar_mentions: List[Dict[str, Any]],
        topic_keywords: List[str],
    ) -> List[Dict[str, Any]]:
        """Score and sort chunks based on relevance signals."""
        mentioned_ids = {s["id"] for s in scholar_mentions}
        mentioned_madhhabs = {s.get("madhab", "") for s in scholar_mentions}

        def score(chunk: Dict[str, Any]) -> float:
            base = chunk.get("rrf_score", 0.0) + chunk.get("dense_score", 0.0) * 0.3

            # Boost if scholar was explicitly mentioned
            scholar_id = chunk.get("scholar_id") or chunk.get("metadata", {}).get("scholar_id", "")
            if scholar_id in mentioned_ids:
                base += 0.5

            # Boost if madhab matches
            madhab = chunk.get("madhab") or chunk.get("metadata", {}).get("madhab", "")
            if madhab in mentioned_madhhabs:
                base += 0.2

            # Boost if topic tags overlap with extracted keywords
            tags = chunk.get("topic_tags", [])
            if isinstance(tags, str):
                import json
                try:
                    tags = json.loads(tags)
                except Exception:
                    tags = []
            kw_overlap = len(set(tags) & set(topic_keywords))
            base += kw_overlap * 0.1

            return base

        return sorted(chunks, key=score, reverse=True)

    def _enrich_with_kg(self, chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Add KG metadata (scholar name, madhab, book title) to each chunk."""
        enriched: List[Dict[str, Any]] = []
        for chunk in chunks:
            cid = chunk.get("id", "")
            ref = self.kg.get_reference_for_chunk(cid)
            if ref:
                chunk = dict(chunk)
                chunk["scholar_name"] = ref.scholar_name
                chunk["madhab"] = ref.madhab
                chunk["book_title"] = ref.book_title
                chunk["edition"] = ref.edition
                chunk["publisher"] = ref.publisher
                chunk["volume"] = ref.volume
                chunk["page"] = ref.page
                chunk["juz"] = ref.juz
                chunk["chapter"] = ref.chapter
                chunk["section"] = ref.section
            enriched.append(chunk)
        return enriched

    def _build_references(self, chunks: List[Dict[str, Any]]) -> List[Reference]:
        """Convert enriched chunks into Reference objects."""
        refs: List[Reference] = []
        seen: set = set()
        for chunk in chunks:
            cid = chunk.get("id", "")
            if cid in seen:
                continue
            seen.add(cid)
            refs.append(Reference(
                scholar_name=chunk.get("scholar_name"),
                madhab=chunk.get("madhab"),
                book_title=chunk.get("book_title"),
                juz=chunk.get("juz"),
                volume=chunk.get("volume"),
                page=chunk.get("page"),
                section=chunk.get("section"),
                chapter=chunk.get("chapter"),
                edition=chunk.get("edition"),
                publisher=chunk.get("publisher"),
                text_excerpt=(chunk.get("content", "")[:200] if chunk.get("content") else None),
                chunk_id=cid,
            ))
        return refs

    def _build_comparison_table(
        self,
        references: List[Reference],
        llm_comparisons: List[Dict[str, Any]],
    ) -> List[ScholarComparison]:
        """Build a ScholarComparison list, merging LLM output with reference metadata."""
        comparisons: List[ScholarComparison] = []
        seen_madhhabs: set = set()

        # Use LLM-generated comparisons if available
        for comp in llm_comparisons:
            madhab = comp.get("madhab", "")
            scholar_name = comp.get("scholar_name", "")
            position = comp.get("position", "")
            evidence = comp.get("evidence", "")

            # Find matching references
            matching_refs = [r for r in references if r.madhab == madhab]

            comparisons.append(ScholarComparison(
                madhab=madhab,
                scholar_name=scholar_name,
                position=position,
                evidence=evidence,
                references=matching_refs[:3],
            ))
            seen_madhhabs.add(madhab)

        # Add madhab groups from references not covered by LLM output
        madhab_refs: Dict[str, List[Reference]] = {}
        for ref in references:
            if ref.madhab and ref.madhab not in seen_madhhabs:
                madhab_refs.setdefault(ref.madhab, []).append(ref)

        for madhab, refs in madhab_refs.items():
            if refs:
                comparisons.append(ScholarComparison(
                    madhab=madhab,
                    scholar_name=refs[0].scholar_name or "",
                    position="",
                    evidence=None,
                    references=refs[:3],
                ))

        return comparisons
