from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

FileStatus = Literal["uploading", "processing", "indexed", "error"]
FileExt = Literal["pdf", "txt", "md", "docx", "csv", "other"]


class FileRecord(BaseModel):
    id: str
    name: str
    status: FileStatus
    addedAt: str
    size: str
    ext: FileExt
    error: Optional[str] = None


class ConversationMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1)
    session_id: str = Field(default="default")
    conversation_history: list[ConversationMessage] = Field(default_factory=list)


class SourceCitation(BaseModel):
    filename: str
    chunk_preview: str
    score: float = 0.0


class ChatResponse(BaseModel):
    answer: str
    summary: str
    sources: list[SourceCitation]
    recommended_action: str
    missing_info: Optional[str] = None
    confidence: float = 0.8
    model_used: str
