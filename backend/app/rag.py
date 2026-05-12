"""RAG engine — LlamaIndex + Pinecone + Qwen via DashScope.

Responsibilities:
- Bootstrap LLM, embedding model, vector store (singleton)
- Ingest documents (parse → chunk → embed → upsert) with file_id metadata
- Delete a file's chunks by metadata filter
- Run a chat query with retrieval + structured JSON answer
- Per-session chat memory
"""
from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from threading import Lock
from typing import Optional

from llama_index.core import Settings, StorageContext, VectorStoreIndex
from llama_index.core.llms import ChatMessage, MessageRole
from llama_index.core.memory import ChatMemoryBuffer
from llama_index.core.node_parser import SentenceSplitter
from llama_index.core.schema import NodeWithScore
from llama_index.core.vector_stores.types import MetadataFilter, MetadataFilters, FilterOperator
from llama_index.embeddings.dashscope import (
    DashScopeEmbedding,
    DashScopeTextEmbeddingModels,
)
from llama_index.llms.openai_like import OpenAILike
from llama_index.vector_stores.pinecone import PineconeVectorStore
from pinecone import Pinecone, ServerlessSpec

from .config import get_settings
from .parser import parse_file
from .schemas import ChatResponse, ConversationMessage, SourceCitation
from .usage import get_counter

logger = logging.getLogger(__name__)

_engine_lock = Lock()
_engine: Optional["RagEngine"] = None


# ─── Prompt ──────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are NexVision Brain, an AI business analyst that answers questions strictly from the user's uploaded company documents.

CRITICAL OUTPUT RULES:
- Respond with a single JSON object. No prose before or after.
- Use plain text in every string field. NEVER use markdown formatting: no asterisks, no **bold**, no _italics_, no backticks, no headings, no bullet points.
- Reference source filenames inline using their exact names (e.g. "policy.pdf"), without any formatting.
- Be concrete. Cite specific facts from the context. If the context does not contain the answer, say so honestly in `missing_info`.

JSON SCHEMA (all fields required, missing_info may be null):
{
  "answer": "Direct, conversational answer to the user's question (2-5 sentences, plain text).",
  "summary": "One-sentence reasoning summary explaining how you reached the answer.",
  "recommended_action": "Concrete next step the user or their staff should take.",
  "missing_info": "What information is missing from the documents to give a fuller answer, or null if nothing is missing.",
  "confidence": 0.0
}
confidence is a float between 0 and 1 reflecting how well the documents support the answer."""

QUERY_TEMPLATE = """Conversation so far:
{history}

Retrieved context from the user's documents:
{context}

User question: {question}

Respond with the JSON object as instructed."""


# ─── Engine ──────────────────────────────────────────────────────────────────


class RagEngine:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._init_models()
        self._init_vector_store()
        self._memories: dict[str, ChatMemoryBuffer] = {}

    # -- bootstrap --------------------------------------------------------

    def _init_models(self) -> None:
        s = self.settings
        if not s.dashscope_api_key:
            raise RuntimeError("DASHSCOPE_API_KEY is not set")

        # Configure the global DashScope SDK to use the international endpoint
        # (it defaults to the China endpoint, which rejects intl-region keys).
        import os as _os

        import dashscope as _dashscope

        intl_base = "https://dashscope-intl.aliyuncs.com/api/v1"
        _os.environ.setdefault("DASHSCOPE_HTTP_BASE_URL", intl_base)
        _dashscope.base_http_api_url = intl_base
        _dashscope.api_key = s.dashscope_api_key

        self.llm = OpenAILike(
            model=s.qwen_llm_model,
            api_base=s.dashscope_base_url,
            api_key=s.dashscope_api_key,
            is_chat_model=True,
            is_function_calling_model=False,
            temperature=0.2,
            max_tokens=1500,
            timeout=60,
            additional_kwargs={"response_format": {"type": "json_object"}},
        )

        # text-embedding-v3 → 1024 dims by default
        self.embed_model = DashScopeEmbedding(
            model_name=DashScopeTextEmbeddingModels.TEXT_EMBEDDING_V3,
            api_key=s.dashscope_api_key,
        )

        Settings.llm = self.llm
        Settings.embed_model = self.embed_model
        Settings.node_parser = SentenceSplitter(chunk_size=1024, chunk_overlap=120)

    def _init_vector_store(self) -> None:
        s = self.settings
        if not s.pinecone_api_key:
            raise RuntimeError("PINECONE_API_KEY is not set")

        pc = Pinecone(api_key=s.pinecone_api_key)
        existing = {i["name"] for i in pc.list_indexes()}
        if s.pinecone_index_name not in existing:
            logger.info("Creating Pinecone index %s", s.pinecone_index_name)
            pc.create_index(
                name=s.pinecone_index_name,
                dimension=s.qwen_embed_dim,
                metric="cosine",
                spec=ServerlessSpec(cloud=s.pinecone_cloud, region=s.pinecone_region),
            )

        self.pinecone_index = pc.Index(s.pinecone_index_name)
        self.vector_store = PineconeVectorStore(pinecone_index=self.pinecone_index)
        self.storage_context = StorageContext.from_defaults(vector_store=self.vector_store)
        # Attach an index handle for retrieval
        self.index = VectorStoreIndex.from_vector_store(
            vector_store=self.vector_store,
            embed_model=self.embed_model,
        )

    # -- ingestion --------------------------------------------------------

    def ingest_file(self, file_path: Path, file_id: str, file_name: str) -> tuple[int, list[str]]:
        """Parse, chunk, embed, and upsert a single file. Returns (chunk_count, node_ids)."""
        docs = parse_file(file_path)
        for d in docs:
            d.metadata = {
                **(d.metadata or {}),
                "file_id": file_id,
                "file_name": file_name,
            }
            d.excluded_llm_metadata_keys = ["file_id"]
            d.excluded_embed_metadata_keys = ["file_id", "file_name"]

        # Build nodes via the configured splitter
        splitter = SentenceSplitter(chunk_size=1024, chunk_overlap=120)
        nodes = splitter.get_nodes_from_documents(docs)
        for n in nodes:
            n.metadata = {
                **(n.metadata or {}),
                "file_id": file_id,
                "file_name": file_name,
            }

        if not nodes:
            return 0, []

        # Capture node IDs before insertion (LlamaIndex uses these as Pinecone vector IDs)
        node_ids = [n.node_id for n in nodes]

        # Insert into the existing index → embeds + upserts to Pinecone
        self.index.insert_nodes(nodes)

        # Track usage: rough token estimate (avg 350 tokens per chunk)
        get_counter().increment("embed_tokens", len(nodes) * 350)

        return len(nodes), node_ids

    def delete_file(self, file_id: str, node_ids: Optional[list[str]] = None) -> None:
        """Remove all vectors for a file from Pinecone.

        Prefers deletion by stored node IDs (reliable on serverless Pinecone).
        Falls back to metadata filter delete if no IDs are available.
        """
        if node_ids:
            try:
                # Batch delete in chunks of 100 (Pinecone API limit)
                for i in range(0, len(node_ids), 100):
                    self.pinecone_index.delete(ids=node_ids[i : i + 100])
                logger.info("Deleted %d vectors for file %s by ID", len(node_ids), file_id)
                return
            except Exception as exc:  # noqa: BLE001
                logger.warning("Pinecone delete-by-id failed for %s, trying filter: %s", file_id, exc)
        # Fallback: metadata filter (works on pod indexes; may not work on serverless)
        try:
            self.pinecone_index.delete(filter={"file_id": {"$eq": file_id}})
            logger.info("Deleted vectors for file %s via metadata filter", file_id)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Pinecone delete failed for %s: %s", file_id, exc)

    def reset_index(self, node_ids: Optional[list[str]] = None) -> None:
        """Delete all vectors in the index.

        Prefers deletion by stored node IDs (required on serverless Pinecone,
        which does NOT support delete_all=True).  Falls back to delete_all for
        pod-based indexes when no IDs are available.
        """
        if node_ids:
            try:
                for i in range(0, len(node_ids), 100):
                    self.pinecone_index.delete(ids=node_ids[i : i + 100])
                logger.info("Reset: deleted %d vectors by ID", len(node_ids))
            except Exception as exc:  # noqa: BLE001
                logger.warning("Reset delete-by-id failed, trying delete_all: %s", exc)
                try:
                    self.pinecone_index.delete(delete_all=True)
                except Exception as exc2:  # noqa: BLE001
                    logger.warning("Pinecone delete_all also failed: %s", exc2)
        else:
            # No known IDs — attempt delete_all (only works on pod indexes)
            try:
                self.pinecone_index.delete(delete_all=True)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Pinecone reset failed (no node_ids available): %s", exc)
        self._memories.clear()

    # -- chat -------------------------------------------------------------

    def get_memory(self, session_id: str) -> ChatMemoryBuffer:
        if session_id not in self._memories:
            self._memories[session_id] = ChatMemoryBuffer.from_defaults(token_limit=3000)
        return self._memories[session_id]

    def reset_memory(self, session_id: str) -> None:
        self._memories.pop(session_id, None)

    def chat(
        self,
        question: str,
        session_id: str = "default",
        history: Optional[list[ConversationMessage]] = None,
        file_ids: Optional[list[str]] = None,
    ) -> ChatResponse:
        # Scope retrieval to only the currently active files to prevent stale vectors
        # from deleted or orphaned uploads (e.g. after a Vercel cold start) from bleeding in.
        if file_ids:
            filters = MetadataFilters(
                filters=[
                    MetadataFilter(
                        key="file_id",
                        operator=FilterOperator.IN,
                        value=file_ids,
                    )
                ]
            )
            retriever = self.index.as_retriever(similarity_top_k=5, filters=filters)
        else:
            retriever = self.index.as_retriever(similarity_top_k=5)
        nodes: list[NodeWithScore] = retriever.retrieve(question)

        context_blocks: list[str] = []
        sources: list[SourceCitation] = []
        seen_files: set[str] = set()
        for n in nodes:
            fname = (n.node.metadata or {}).get("file_name", "unknown")
            text = n.node.get_content().strip()
            context_blocks.append(f"[Source: {fname}]\n{text}")
            preview = re.sub(r"\s+", " ", text)[:220]
            if fname not in seen_files:
                sources.append(
                    SourceCitation(
                        filename=fname,
                        chunk_preview=preview,
                        score=float(n.score or 0.0),
                    )
                )
                seen_files.add(fname)

        memory = self.get_memory(session_id)
        # Always rebuild memory from the frontend-supplied history so that
        # Vercel cold-start instances (which have empty in-memory state)
        # answer with the correct conversation context.  We reset the buffer
        # and re-populate from the canonical history the client maintains.
        memory.reset()
        if history:
            for h in history:
                role = MessageRole.USER if h.role == "user" else MessageRole.ASSISTANT
                memory.put(ChatMessage(role=role, content=h.content))

        history_text = self._format_history(memory.get())
        context_text = "\n\n---\n\n".join(context_blocks) if context_blocks else "[No documents indexed yet.]"

        user_prompt = QUERY_TEMPLATE.format(
            history=history_text or "[no prior turns]",
            context=context_text,
            question=question,
        )

        messages = [
            ChatMessage(role=MessageRole.SYSTEM, content=SYSTEM_PROMPT),
            ChatMessage(role=MessageRole.USER, content=user_prompt),
        ]
        resp = self.llm.chat(messages)
        raw = resp.message.content or ""

        # Track usage counters
        ctr = get_counter()
        ctr.increment("chat_questions")
        # Estimate tokens: input prompt chars / 3.5, output chars / 3.5
        ctr.increment("llm_tokens", int((len(user_prompt) + len(SYSTEM_PROMPT)) / 3.5 + len(raw) / 3.5))
        # Embedding call for query retrieval (~avg 80 tokens per question)
        ctr.increment("embed_tokens", 80)
        parsed = self._parse_json(raw)

        answer = self._strip_markdown(parsed.get("answer", "I could not produce an answer."))
        summary = self._strip_markdown(parsed.get("summary", ""))
        recommended = self._strip_markdown(parsed.get("recommended_action", ""))
        missing = parsed.get("missing_info")
        if isinstance(missing, str):
            missing = self._strip_markdown(missing) or None
        elif missing is not None and not isinstance(missing, str):
            missing = None

        try:
            confidence = float(parsed.get("confidence", 0.7))
        except (TypeError, ValueError):
            confidence = 0.7

        if not nodes:
            missing = missing or "No documents have been indexed yet. Upload files first."
            confidence = min(confidence, 0.3)

        # Persist turn to memory
        memory.put(ChatMessage(role=MessageRole.USER, content=question))
        memory.put(ChatMessage(role=MessageRole.ASSISTANT, content=answer))

        return ChatResponse(
            answer=answer,
            summary=summary,
            sources=sources,
            recommended_action=recommended,
            missing_info=missing,
            confidence=max(0.0, min(1.0, confidence)),
            model_used=self.settings.qwen_llm_model,
        )

    # -- helpers ----------------------------------------------------------

    @staticmethod
    def _format_history(messages: list[ChatMessage]) -> str:
        lines = []
        for m in messages[-8:]:
            role = "User" if m.role == MessageRole.USER else "Assistant"
            lines.append(f"{role}: {m.content}")
        return "\n".join(lines)

    @staticmethod
    def _parse_json(raw: str) -> dict:
        text = raw.strip()
        # Strip code fences if present
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)
        try:
            return json.loads(text)
        except Exception:
            # Try to extract first JSON object
            match = re.search(r"\{.*\}", text, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group(0))
                except Exception:
                    pass
        return {"answer": text, "summary": "", "recommended_action": "", "missing_info": None, "confidence": 0.5}

    @staticmethod
    def _strip_markdown(text: str) -> str:
        if not text:
            return ""
        # Remove **bold**, *italic*, __bold__, _italic_, `code`
        text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
        text = re.sub(r"__([^_]+)__", r"\1", text)
        text = re.sub(r"(?<!\*)\*([^*\n]+?)\*(?!\*)", r"\1", text)
        text = re.sub(r"(?<!_)_([^_\n]+?)_(?!_)", r"\1", text)
        text = re.sub(r"`([^`]+)`", r"\1", text)
        # Remove leading list / heading markers
        text = re.sub(r"^\s*#{1,6}\s+", "", text, flags=re.MULTILINE)
        text = re.sub(r"^\s*[-*]\s+", "", text, flags=re.MULTILINE)
        return text.strip()


def get_engine() -> RagEngine:
    global _engine
    if _engine is None:
        with _engine_lock:
            if _engine is None:
                _engine = RagEngine()
    return _engine
