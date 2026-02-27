from typing import Literal

from pydantic import BaseModel, Field


# --- Chats ---

class ChatCreate(BaseModel):
    id: str = Field(pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
    model: str = Field(default="openclaw:main", max_length=100)
    title: str = Field(default="", max_length=200)


class ChatUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    category_id: int | None = None
    tag_ids: list[int] | None = Field(default=None, max_length=20)


class AttachmentOut(BaseModel):
    id: str
    filename: str
    content_type: str
    size: int
    url: str


class MessageIn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=500_000)
    attachment_ids: list[str] = Field(default=[], max_length=10)


class MessagesAppend(BaseModel):
    messages: list[MessageIn]


class MessageOut(BaseModel):
    id: int
    role: str
    content: str
    created_at: str
    attachments: list[AttachmentOut] = []


class ChatSummary(BaseModel):
    id: str
    title: str
    model: str
    category_id: int | None
    tag_ids: list[int]
    created_at: str
    updated_at: str


class ChatDetail(ChatSummary):
    messages: list[MessageOut]


# --- Categories ---

class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    sort_order: int = Field(default=0, ge=-1000, le=1000)


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    sort_order: int | None = Field(default=None, ge=-1000, le=1000)


class CategoryOut(BaseModel):
    id: int
    name: str
    sort_order: int


# --- Tags ---

class TagCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    color: str = Field(default="#6b7280", pattern=r"^#[0-9a-fA-F]{6}$")


class TagUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=50)
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")


class TagOut(BaseModel):
    id: int
    name: str
    color: str


# --- Search ---

class SearchResult(BaseModel):
    chat_id: str
    chat_title: str
    message_id: int
    role: str
    snippet: str


# --- Password ---

class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=200)


# --- Models ---

class ModelOut(BaseModel):
    id: str
    model: str
    name: str
