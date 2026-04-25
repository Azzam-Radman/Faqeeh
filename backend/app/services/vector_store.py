"""ChromaDB + BM25 hybrid vector store with RRF fusion."""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional

import numpy as np

logger = logging.getLogger(__name__)


class HybridVectorStore:
    """Combines dense (ChromaDB) and sparse (BM25) retrieval with RRF fusion."""

    RRF_K = 60  # RRF constant

    def __init__(self, persist_dir: str, model_name: str) -> None:
        self.persist_dir = persist_dir
        self.model_name = model_name
        os.makedirs(persist_dir, exist_ok=True)

        # Lazy imports to allow the module to load even when packages are absent
        import chromadb
        from sentence_transformers import SentenceTransformer

        self._chroma_client = chromadb.PersistentClient(path=persist_dir)
        self._collection = self._chroma_client.get_or_create_collection(
            name="fiqh_chunks",
            metadata={"hnsw:space": "cosine"},
        )
        self._encoder = SentenceTransformer(model_name)

        # BM25 state
        self._bm25: Any = None
        self._bm25_ids: List[str] = []
        self._rebuild_bm25()

    # ------------------------------------------------------------------
    # Encoding
    # ------------------------------------------------------------------

    def _encode(self, texts: List[str]) -> List[List[float]]:
        """Encode a list of texts using the SentenceTransformer model."""
        from app.utils.text_utils import normalize_arabic

        # Prefix required by multilingual-e5 models
        prefixed = [f"passage: {normalize_arabic(t)}" for t in texts]
        embeddings = self._encoder.encode(prefixed, normalize_embeddings=True)
        return embeddings.tolist()

    def _encode_query(self, text: str) -> List[float]:
        from app.utils.text_utils import normalize_arabic

        prefixed = f"query: {normalize_arabic(text)}"
        embedding = self._encoder.encode([prefixed], normalize_embeddings=True)
        return embedding[0].tolist()

    # ------------------------------------------------------------------
    # BM25
    # ------------------------------------------------------------------

    def _rebuild_bm25(self) -> None:
        """Rebuild the BM25 index from all documents currently in ChromaDB."""
        try:
            from rank_bm25 import BM25Okapi
            from app.utils.text_utils import arabic_tokenize

            total = self._collection.count()
            if total == 0:
                self._bm25 = None
                self._bm25_ids = []
                return

            # Fetch all docs (ChromaDB supports fetching all with large limit)
            batch_size = 5000
            all_ids: List[str] = []
            all_docs: List[str] = []

            offset = 0
            while True:
                result = self._collection.get(
                    limit=batch_size,
                    offset=offset,
                    include=["documents"],
                )
                if not result["ids"]:
                    break
                all_ids.extend(result["ids"])
                all_docs.extend(result["documents"] or [])
                offset += batch_size
                if len(result["ids"]) < batch_size:
                    break

            tokenised = [arabic_tokenize(doc) for doc in all_docs]
            self._bm25 = BM25Okapi(tokenised)
            self._bm25_ids = all_ids
            logger.info("BM25 index rebuilt with %d documents", len(all_ids))
        except Exception as exc:
            logger.warning("Failed to rebuild BM25 index: %s", exc)
            self._bm25 = None
            self._bm25_ids = []

    # ------------------------------------------------------------------
    # Add / Delete
    # ------------------------------------------------------------------

    def add_documents(self, docs: List[Dict[str, Any]]) -> None:
        """Add documents to ChromaDB and rebuild the BM25 index.

        Each doc dict must have:
            id (str), content (str), metadata (dict)
        """
        if not docs:
            return

        ids = [d["id"] for d in docs]
        contents = [d["content"] for d in docs]
        metadatas = [d.get("metadata", {}) for d in docs]

        # Encode in batches to respect memory
        embeddings = self._encode(contents)

        self._collection.upsert(
            ids=ids,
            documents=contents,
            embeddings=embeddings,
            metadatas=metadatas,
        )
        self._rebuild_bm25()
        logger.info("Added %d documents to vector store", len(docs))

    def delete_by_book(self, book_id: str) -> None:
        """Remove all chunks belonging to a book."""
        try:
            results = self._collection.get(
                where={"book_id": book_id},
                include=[],
            )
            ids_to_delete = results.get("ids", [])
            if ids_to_delete:
                self._collection.delete(ids=ids_to_delete)
                self._rebuild_bm25()
                logger.info("Deleted %d chunks for book %s", len(ids_to_delete), book_id)
        except Exception as exc:
            logger.error("Failed to delete chunks for book %s: %s", book_id, exc)

    # ------------------------------------------------------------------
    # Search
    # ------------------------------------------------------------------

    def hybrid_search(
        self,
        query: str,
        k: int = 10,
        filter_metadata: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """Hybrid search combining dense (ChromaDB) and sparse (BM25) with RRF."""
        from app.utils.text_utils import arabic_tokenize

        query_embedding = self._encode_query(query)
        query_tokens = arabic_tokenize(query)

        # ---- Dense retrieval ----
        dense_k = min(k * 3, max(self._collection.count(), 1))
        chroma_kwargs: Dict[str, Any] = {
            "query_embeddings": [query_embedding],
            "n_results": dense_k,
            "include": ["documents", "metadatas", "distances"],
        }
        if filter_metadata:
            chroma_kwargs["where"] = filter_metadata

        try:
            dense_result = self._collection.query(**chroma_kwargs)
        except Exception as exc:
            logger.warning("ChromaDB query failed: %s", exc)
            dense_result = {"ids": [[]], "documents": [[]], "metadatas": [[]], "distances": [[]]}

        dense_ids: List[str] = dense_result["ids"][0] if dense_result["ids"] else []
        dense_docs: List[str] = (
            dense_result["documents"][0] if dense_result["documents"] else []
        )
        dense_metas: List[Dict] = (
            dense_result["metadatas"][0] if dense_result["metadatas"] else []
        )
        dense_distances: List[float] = (
            dense_result["distances"][0] if dense_result["distances"] else []
        )

        # Map id -> (doc, meta, distance, dense_rank)
        id_to_info: Dict[str, Dict[str, Any]] = {}
        for rank, (doc_id, doc, meta, dist) in enumerate(
            zip(dense_ids, dense_docs, dense_metas, dense_distances)
        ):
            id_to_info[doc_id] = {
                "id": doc_id,
                "content": doc,
                "metadata": meta,
                "dense_score": 1.0 - dist,
                "dense_rank": rank,
                "sparse_rank": None,
            }

        # ---- Sparse retrieval (BM25) ----
        bm25_ids: List[str] = []
        if self._bm25 is not None and query_tokens:
            scores = self._bm25.get_scores(query_tokens)
            scored_pairs = sorted(
                enumerate(scores), key=lambda x: x[1], reverse=True
            )
            top_bm25 = scored_pairs[: k * 3]
            for sparse_rank, (idx, score) in enumerate(top_bm25):
                if idx < len(self._bm25_ids) and score > 0:
                    doc_id = self._bm25_ids[idx]
                    bm25_ids.append(doc_id)
                    if doc_id in id_to_info:
                        id_to_info[doc_id]["sparse_rank"] = sparse_rank
                    else:
                        # Fetch doc from ChromaDB
                        try:
                            fetched = self._collection.get(
                                ids=[doc_id],
                                include=["documents", "metadatas"],
                            )
                            if fetched["ids"]:
                                id_to_info[doc_id] = {
                                    "id": doc_id,
                                    "content": (fetched["documents"] or [""])[0],
                                    "metadata": (fetched["metadatas"] or [{}])[0],
                                    "dense_score": 0.0,
                                    "dense_rank": None,
                                    "sparse_rank": sparse_rank,
                                }
                        except Exception:
                            pass

        # ---- RRF Fusion ----
        def rrf_score(dense_rank: Optional[int], sparse_rank: Optional[int]) -> float:
            score = 0.0
            if dense_rank is not None:
                score += 1.0 / (self.RRF_K + dense_rank + 1)
            if sparse_rank is not None:
                score += 1.0 / (self.RRF_K + sparse_rank + 1)
            return score

        ranked = sorted(
            id_to_info.values(),
            key=lambda x: rrf_score(x["dense_rank"], x["sparse_rank"]),
            reverse=True,
        )

        # Apply metadata filter to BM25-only results if needed
        if filter_metadata:
            filtered = []
            for doc in ranked:
                meta = doc.get("metadata", {})
                if all(meta.get(k) == v for k, v in filter_metadata.items()):
                    filtered.append(doc)
            ranked = filtered

        result = []
        for doc in ranked[:k]:
            doc["rrf_score"] = rrf_score(doc["dense_rank"], doc["sparse_rank"])
            result.append(doc)
        return result

    def get_document(self, doc_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a single document by ID."""
        try:
            result = self._collection.get(
                ids=[doc_id],
                include=["documents", "metadatas"],
            )
            if result["ids"]:
                return {
                    "id": result["ids"][0],
                    "content": (result["documents"] or [""])[0],
                    "metadata": (result["metadatas"] or [{}])[0],
                }
        except Exception as exc:
            logger.error("Failed to get document %s: %s", doc_id, exc)
        return None

    def count_documents(self) -> int:
        """Return total number of documents in the collection."""
        return self._collection.count()
