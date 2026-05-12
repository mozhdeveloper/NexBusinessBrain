"""Simple file metadata store backed by a JSON file."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Optional

from .config import get_settings
from .schemas import FileExt, FileRecord, FileStatus

_lock = Lock()
_EXT_MAP = {
    ".pdf": "pdf",
    ".txt": "txt",
    ".md": "md",
    ".docx": "docx",
    ".csv": "csv",
}


def get_ext(name: str) -> FileExt:
    suffix = Path(name).suffix.lower()
    return _EXT_MAP.get(suffix, "other")  # type: ignore[return-value]


def format_size(num_bytes: int) -> str:
    if num_bytes >= 1024 * 1024:
        return f"{num_bytes / (1024 * 1024):.1f} MB"
    if num_bytes >= 1024:
        return f"{round(num_bytes / 1024)} KB"
    return f"{num_bytes} B"


def _read_all() -> dict:
    settings = get_settings()
    path = settings.files_index
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _write_all(data: dict) -> None:
    settings = get_settings()
    settings.files_index.parent.mkdir(parents=True, exist_ok=True)
    settings.files_index.write_text(json.dumps(data, indent=2), encoding="utf-8")


def list_files() -> list[FileRecord]:
    with _lock:
        data = _read_all()
    records = [FileRecord(**v) for v in data.values()]
    records.sort(key=lambda r: r.addedAt, reverse=True)
    return records


def get_file(file_id: str) -> Optional[FileRecord]:
    with _lock:
        data = _read_all()
    raw = data.get(file_id)
    return FileRecord(**raw) if raw else None


def upsert_file(record: FileRecord) -> None:
    with _lock:
        data = _read_all()
        data[record.id] = record.model_dump()
        _write_all(data)


def update_status(file_id: str, status: FileStatus, error: Optional[str] = None) -> Optional[FileRecord]:
    with _lock:
        data = _read_all()
        raw = data.get(file_id)
        if not raw:
            return None
        raw["status"] = status
        if error is not None:
            raw["error"] = error
        data[file_id] = raw
        _write_all(data)
        return FileRecord(**raw)


def update_node_ids(file_id: str, node_ids: list[str]) -> None:
    """Persist Pinecone vector IDs so we can delete them by ID later."""
    with _lock:
        data = _read_all()
        raw = data.get(file_id)
        if raw:
            raw["node_ids"] = node_ids
            data[file_id] = raw
            _write_all(data)


def delete_file_record(file_id: str) -> Optional[FileRecord]:
    with _lock:
        data = _read_all()
        raw = data.pop(file_id, None)
        if raw:
            _write_all(data)
        return FileRecord(**raw) if raw else None


def reset_all_records() -> None:
    with _lock:
        _write_all({})
        # Remove uploaded files from disk
        settings = get_settings()
        if settings.uploads_dir.exists():
            for f in settings.uploads_dir.glob("*"):
                try:
                    f.unlink()
                except Exception:
                    pass


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
