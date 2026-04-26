"""Claude API integration for مساعد الفقيه."""

from __future__ import annotations

import json
import logging
import re
from typing import Any, AsyncGenerator, Dict, List, Optional

logger = logging.getLogger(__name__)

_SYSTEM_AR = """أنت "مساعد الفقيه"، خبير في الفقه الإسلامي ومذاهبه الأربعة الكبرى: الحنفي، والمالكي، والشافعي، والحنبلي.

مهمتك الإجابة على الأسئلة الفقهية بدقة علمية مع الاستشهاد الكامل بالمراجع.

قواعد الإجابة:
1. اذكر القول مع المرجع الكامل: (الكتاب، الجزء، الصفحة، الطبعة، الناشر).
2. إذا اختلفت المذاهب، اعرض كل مذهب على حدة مع دليله.
3. استخدم أرقام المراجع [1]، [2]، [3] للإشارة إلى المصادر.
4. أجب بلغة السؤال دائماً (عربي إذا كان السؤال عربياً، وإنجليزي إذا كان إنجليزياً).
5. لا تخترع معلومات غير موجودة في السياق المقدم.
6. إذا لم يكن في السياق إجابة كافية، فقل ذلك صراحةً.
7. ابدأ الإجابة مباشرةً دون مقدمات زائدة.

هيكل الإجابة المطلوب (JSON):
{
  "answer": "نص الإجابة الكاملة مع أرقام المراجع",
  "scholars_comparison": [
    {
      "madhab": "hanafi|maliki|shafii|hanbali",
      "scholar_name": "اسم العالم",
      "position": "موقف المذهب",
      "evidence": "الدليل المستخدم",
      "references": ["[1]", "[2]"]
    }
  ],
  "summary": "ملخص قصير جداً للإجابة"
}"""

_SYSTEM_EN = """You are "مساعد الفقيه" (Fiqh Scholar Assistant), an expert in Islamic jurisprudence and the four major schools of Islamic law: Hanafi, Maliki, Shafi'i, and Hanbali.

Your task is to answer Islamic legal questions with scholarly precision and full citations.

Rules:
1. Cite sources fully: (Book title, volume, page, edition, publisher).
2. If the schools of law differ, present each school's position with its evidence.
3. Use reference numbers [1], [2], [3] to indicate sources.
4. Always answer in the language of the question.
5. Do not fabricate information not found in the provided context.
6. If the context lacks sufficient information, state this clearly.
7. Begin the answer directly without unnecessary preamble.

Required response structure (JSON):
{
  "answer": "Full answer text with reference numbers",
  "scholars_comparison": [
    {
      "madhab": "hanafi|maliki|shafii|hanbali",
      "scholar_name": "Scholar name",
      "position": "School's position",
      "evidence": "Evidence used",
      "references": ["[1]", "[2]"]
    }
  ],
  "summary": "Very brief summary of the answer"
}"""


class LLMService:
    """Handles Claude API calls for fiqh question answering."""

    def __init__(self, api_key: str, model: str = "claude-sonnet-4-6") -> None:
        import anthropic

        self._client = anthropic.Anthropic(api_key=api_key)
        self._async_client = anthropic.AsyncAnthropic(api_key=api_key)
        self.model = model

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def generate(
        self,
        query: str,
        context_chunks: List[Dict[str, Any]],
        language: str = "ar",
        stream: bool = False,
    ) -> Dict[str, Any]:
        """Generate a synchronous response from Claude."""
        context = self._format_context(context_chunks)
        messages = self._build_messages(query, context, language)
        system_prompt = _SYSTEM_AR if language == "ar" else _SYSTEM_EN

        response = self._client.messages.create(
            model=self.model,
            max_tokens=4096,
            system=system_prompt,
            messages=messages,
        )
        response_text = response.content[0].text if response.content else ""
        return self._parse_response(response_text)

    async def stream_generate(
        self,
        query: str,
        context_chunks: List[Dict[str, Any]],
        language: str = "ar",
    ) -> AsyncGenerator[str, None]:
        """Async generator yielding response text chunks."""
        context = self._format_context(context_chunks)
        messages = self._build_messages(query, context, language)
        system_prompt = _SYSTEM_AR if language == "ar" else _SYSTEM_EN

        async with self._async_client.messages.stream(
            model=self.model,
            max_tokens=4096,
            system=system_prompt,
            messages=messages,
        ) as stream:
            async for text_chunk in stream.text_stream:
                yield text_chunk

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _format_context(self, chunks: List[Dict[str, Any]]) -> str:
        """Format retrieved chunks with numbered reference labels."""
        if not chunks:
            return "لا توجد مراجع متاحة في قاعدة البيانات لهذا الموضوع."

        lines: List[str] = ["المراجع المتاحة:\n"]
        for i, chunk in enumerate(chunks, start=1):
            meta = chunk.get("metadata", {})
            scholar = meta.get("scholar_name") or chunk.get("scholar_name", "")
            book = meta.get("book_title") or chunk.get("book_title", "")
            volume = meta.get("volume") or chunk.get("volume")
            page = meta.get("page") or chunk.get("page")
            juz = meta.get("juz") or chunk.get("juz")
            edition = meta.get("edition") or chunk.get("edition", "")
            publisher = meta.get("publisher") or chunk.get("publisher", "")
            content = chunk.get("content", "")

            ref_parts = []
            if book:
                ref_parts.append(book)
            if volume:
                ref_parts.append(f"ج{volume}")
            if juz:
                ref_parts.append(f"جزء {juz}")
            if page:
                ref_parts.append(f"ص{page}")
            if edition:
                ref_parts.append(f"ط. {edition}")
            if publisher:
                ref_parts.append(publisher)

            ref_str = "، ".join(ref_parts) if ref_parts else "مرجع غير محدد"

            lines.append(
                f"[{i}] {scholar} — {ref_str}\n{content}\n"
            )

        return "\n".join(lines)

    def _parse_response(self, response_text: str) -> Dict[str, Any]:
        """Extract structured answer from Claude's response."""
        # Try to parse JSON from response
        json_match = re.search(r"\{[\s\S]*\}", response_text)
        if json_match:
            try:
                parsed = json.loads(json_match.group())
                return {
                    "answer": parsed.get("answer", response_text),
                    "scholars_comparison": parsed.get("scholars_comparison", []),
                    "summary": parsed.get("summary", ""),
                }
            except (json.JSONDecodeError, ValueError):
                pass

        # Fallback: return raw text as answer
        return {
            "answer": response_text,
            "scholars_comparison": [],
            "summary": "",
        }

    def _build_messages(
        self, query: str, context: str, language: str
    ) -> List[Dict[str, str]]:
        """Build the message list for the Claude API call."""
        if language == "ar":
            user_message = (
                f"السياق الفقهي:\n\n{context}\n\n"
                f"السؤال: {query}\n\n"
                "أجب بصيغة JSON المحددة، مع الاستشهاد بأرقام المراجع [1]، [2]، ... من السياق أعلاه."
            )
        else:
            user_message = (
                f"Fiqh Context:\n\n{context}\n\n"
                f"Question: {query}\n\n"
                "Answer in the JSON format specified, citing reference numbers [1], [2], ... from the context above."
            )

        return [{"role": "user", "content": user_message}]
