"""FastAPI entrypoint — exposes the NexVision RAG MVP API."""
from __future__ import annotations

import logging
import shutil
import uuid
from pathlib import Path

from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from . import file_store
from .config import get_settings
from .rag import get_engine
from .schemas import ChatRequest, ChatResponse, FileRecord
from .usage import get_counter

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("nexvision.api")

settings = get_settings()
app = FastAPI(title="NexVision Brain API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def warmup() -> None:
    try:
        get_engine()
        logger.info("RAG engine initialized")
    except Exception as exc:  # noqa: BLE001
        logger.exception("RAG engine failed to initialize: %s", exc)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/usage")
def usage() -> dict:
    return get_counter().snapshot()


# ─── Files ───────────────────────────────────────────────────────────────────


@app.get("/files", response_model=list[FileRecord])
def list_files() -> list[FileRecord]:
    return file_store.list_files()


@app.post("/files/upload", response_model=FileRecord)
def upload_file(background: BackgroundTasks, file: UploadFile = File(...)) -> FileRecord:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    safe_name = Path(file.filename).name

    # ── Duplicate check ────────────────────────────────────────────────────
    existing = file_store.list_files()
    if any(f.name == safe_name for f in existing):
        raise HTTPException(
            status_code=409,
            detail=f'"{safe_name}" is already in the Knowledge Base. Delete it first to re-upload.',
        )

    file_id = f"f-{uuid.uuid4().hex[:10]}"
    dest = settings.uploads_dir / f"{file_id}__{safe_name}"

    with dest.open("wb") as fh:
        shutil.copyfileobj(file.file, fh)
    size_bytes = dest.stat().st_size

    record = FileRecord(
        id=file_id,
        name=safe_name,
        status="processing",
        addedAt=file_store.now_iso(),
        size=file_store.format_size(size_bytes),
        ext=file_store.get_ext(safe_name),
    )
    file_store.upsert_file(record)

    background.add_task(_ingest_in_background, dest, file_id, safe_name)
    return record


def _ingest_in_background(path: Path, file_id: str, file_name: str) -> None:
    try:
        engine = get_engine()
        chunks = engine.ingest_file(path, file_id, file_name)
        logger.info("Indexed %s with %d chunks", file_name, chunks)
        file_store.update_status(file_id, "indexed")
    except Exception as exc:  # noqa: BLE001
        logger.exception("Ingestion failed for %s: %s", file_name, exc)
        file_store.update_status(file_id, "error", error=str(exc))


@app.delete("/files/{file_id}")
def delete_file(file_id: str) -> dict:
    record = file_store.delete_file_record(file_id)
    if not record:
        raise HTTPException(status_code=404, detail="File not found")

    # Remove from disk
    for p in settings.uploads_dir.glob(f"{file_id}__*"):
        try:
            p.unlink()
        except Exception:
            pass

    try:
        get_engine().delete_file(file_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Vector delete failed: %s", exc)

    return {"ok": True, "id": file_id}


# ─── Chat ────────────────────────────────────────────────────────────────────


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    try:
        engine = get_engine()
        return engine.chat(req.question, session_id=req.session_id, history=req.conversation_history)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Chat failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Chat failed: {exc}")


# ─── Reset ───────────────────────────────────────────────────────────────────


@app.post("/reset")
def reset_all() -> dict:
    file_store.reset_all_records()
    get_counter().reset_all()
    try:
        get_engine().reset_index()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Vector reset failed: %s", exc)
    return {"ok": True}


@app.post("/chat/reset")
def reset_chat(session_id: str = "default") -> dict:
    try:
        get_engine().reset_memory(session_id)
    except Exception:
        pass
    return {"ok": True}
