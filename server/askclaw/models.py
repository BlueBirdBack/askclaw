from pydantic import BaseModel


# --- Chats ---

class ChatCreate(BaseModel):
    id: str
    model: str = "openclaw:main"
    title: str = ""


class ChatUpdate(BaseModel):
    title: str | None = None
    category_id: int | None = None
    tag_ids: list[int] | None = None


class AttachmentOut(BaseModel):
    id: str
    filename: str
    content_type: str
    size: int
    url: str
    storage_path: str | None = None


class MessageIn(BaseModel):
    role: str
    content: str
    attachment_ids: list[str] = []


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
    name: str
    sort_order: int = 0


class CategoryUpdate(BaseModel):
    name: str | None = None
    sort_order: int | None = None


class CategoryOut(BaseModel):
    id: int
    name: str
    sort_order: int


# --- Tags ---

class TagCreate(BaseModel):
    name: str
    color: str = "#6b7280"


class TagUpdate(BaseModel):
    name: str | None = None
    color: str | None = None


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
    new_password: str


# --- Models ---

class ModelOut(BaseModel):
    id: str
    model: str
    name: str
