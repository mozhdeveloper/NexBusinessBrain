"""Daily usage counter — thread-safe, persisted to disk, resets at midnight."""
from __future__ import annotations

import json
import threading
from datetime import date, datetime
from pathlib import Path
from typing import Any

from .config import get_settings

# ── Daily limits ──────────────────────────────────────────────────────────────
LIMITS: dict[str, int] = {
    "chat_questions":   50,
    "llamaparse_pages": 1_000,
    "llm_tokens":       40_000,
    "embed_tokens":     5_000,
}

_METRIC_META: list[tuple[str, str, str]] = [
    ("chat_questions",   "Chat Questions",   "questions"),
    ("llamaparse_pages", "LlamaParse Pages", "pages"),
    ("llm_tokens",       "LLM Tokens",       "tokens"),
    ("embed_tokens",     "Embedding Tokens", "tokens"),
]

_PERSIST_FILE_NAME = "usage_counters.json"


class UsageCounter:
    """Daily counter persisted to disk. Resets at midnight, survives restarts."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._date = date.today()
        self._counts: dict[str, int] = {k: 0 for k in LIMITS}
        self._load()

    # ── persistence ──────────────────────────────────────────────────────────

    def _path(self) -> Path:
        return get_settings().storage_dir / _PERSIST_FILE_NAME

    def _load(self) -> None:
        try:
            raw = json.loads(self._path().read_text(encoding="utf-8"))
            saved_date = date.fromisoformat(raw.get("date", ""))
            if saved_date == date.today():
                for k in LIMITS:
                    self._counts[k] = int(raw.get(k, 0))
            # else: different day → start fresh (counts already zeroed in __init__)
        except Exception:
            pass  # first run or corrupt file

    def _save(self) -> None:
        try:
            payload = {"date": self._date.isoformat(), **self._counts}
            self._path().write_text(json.dumps(payload, indent=2), encoding="utf-8")
        except Exception:
            pass  # non-critical

    # ── internal ─────────────────────────────────────────────────────────────

    def _maybe_reset(self) -> None:
        today = date.today()
        if today != self._date:
            self._date = today
            self._counts = {k: 0 for k in LIMITS}
            self._save()

    # ── public API ────────────────────────────────────────────────────────────

    def increment(self, key: str, amount: int = 1) -> None:
        if key not in LIMITS:
            return
        with self._lock:
            self._maybe_reset()
            self._counts[key] = self._counts.get(key, 0) + amount
            self._save()

    def reset_all(self) -> None:
        with self._lock:
            self._counts = {k: 0 for k in LIMITS}
            self._save()

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            self._maybe_reset()
            tomorrow = datetime.combine(
                date.fromordinal(self._date.toordinal() + 1),
                datetime.min.time(),
            )
            return {
                "reset_at": tomorrow.isoformat(),
                "metrics": [
                    {
                        "key":       key,
                        "label":     label,
                        "used":      self._counts.get(key, 0),
                        "remaining": max(0, LIMITS[key] - self._counts.get(key, 0)),
                        "limit":     LIMITS[key],
                        "unit":      unit,
                    }
                    for key, label, unit in _METRIC_META
                ],
            }


# ── Module-level singleton ────────────────────────────────────────────────────
_counter = UsageCounter()


def get_counter() -> UsageCounter:
    return _counter
