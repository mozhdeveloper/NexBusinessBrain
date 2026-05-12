"""Vercel serverless entry point for the NexVision FastAPI backend."""
import sys
from pathlib import Path

# Make sure the backend root is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.main import app  # noqa: E402 — must come after sys.path fix

__all__ = ["app"]
