"""Settings loaded from environment / .env file."""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")

# On Vercel the filesystem is read-only except /tmp
_VERCEL = bool(os.getenv("VERCEL"))
_STORAGE_BASE = Path("/tmp/nexvision") if _VERCEL else BACKEND_DIR


class Settings:
    # Qwen / DashScope
    dashscope_api_key: str = os.getenv("DASHSCOPE_API_KEY", "")
    dashscope_base_url: str = os.getenv(
        "DASHSCOPE_BASE_URL",
        "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    )
    qwen_llm_model: str = os.getenv("QWEN_LLM_MODEL", "qwen-max")
    qwen_embed_model: str = os.getenv("QWEN_EMBED_MODEL", "text-embedding-v3")
    qwen_embed_dim: int = int(os.getenv("QWEN_EMBED_DIM", "1024"))

    # Pinecone
    pinecone_api_key: str = os.getenv("PINECONE_API_KEY", "")
    pinecone_index_name: str = os.getenv("PINECONE_INDEX_NAME", "nexvision-rag")
    pinecone_cloud: str = os.getenv("PINECONE_CLOUD", "aws")
    pinecone_region: str = os.getenv("PINECONE_REGION", "us-east-1")

    # LlamaParse
    llama_cloud_api_key: str = os.getenv("LLAMA_CLOUD_API_KEY", "")

    # CORS
    cors_origins: list[str] = [
        o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()
    ]

    # Storage (ephemeral on Vercel serverless — /tmp is writable but resets on cold start)
    storage_dir: Path = _STORAGE_BASE / "storage"
    uploads_dir: Path = _STORAGE_BASE / "storage" / "uploads"
    files_index: Path = _STORAGE_BASE / "storage" / "files.json"


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    s.storage_dir.mkdir(parents=True, exist_ok=True)
    s.uploads_dir.mkdir(parents=True, exist_ok=True)
    return s
