import type { Attachment, ChatMessage, Model, ModelInfo, SearchResult } from './types';

// --- Password ---

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: boolean }> {
  const resp = await fetch('/api/password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  if (!resp.ok) {
    throw resp;
  }
  return resp.json();
}

// --- File uploads ---

export async function uploadFiles(files: File[]): Promise<Attachment[]> {
  const formData = new FormData();
  for (const f of files) {
    formData.append('files', f);
  }
  const resp = await fetch('/api/files', {
    method: 'POST',
    body: formData,
  });
  if (!resp.ok) {
    throw new Error(`Upload failed: ${resp.status}`);
  }
  return resp.json();
}

export function readFileAsBase64(file: File): Promise<{ data: string; media_type: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // "data:image/jpeg;base64,/9j/4AAQ..." → extract media_type and raw base64
      const comma = dataUrl.indexOf(',');
      const meta = dataUrl.slice(5, comma); // "image/jpeg;base64"
      const media_type = meta.split(';')[0];
      const data = dataUrl.slice(comma + 1);
      resolve({ data, media_type });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// --- Chat persistence API ---

export async function createChat(id: string, model: Model): Promise<void> {
  await fetch('/api/chats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, model }),
  });
}

export async function saveMessages(
  chatId: string,
  messages: { role: string; content: string; attachment_ids?: string[] }[],
): Promise<void> {
  await fetch(`/api/chats/${chatId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
}

export interface ChatSummary {
  id: string;
  title: string;
  model: string;
  category_id: number | null;
  tag_ids: number[];
  created_at: string;
  updated_at: string;
}

export async function fetchChats(): Promise<ChatSummary[]> {
  const resp = await fetch('/api/chats');
  if (!resp.ok) return [];
  return resp.json();
}

export interface ChatDetail extends ChatSummary {
  messages: {
    id: number;
    role: string;
    content: string;
    created_at: string;
    attachments?: Attachment[];
  }[];
}

export async function fetchChat(id: string): Promise<ChatDetail | null> {
  const resp = await fetch(`/api/chats/${id}`);
  if (!resp.ok) return null;
  return resp.json();
}

export async function deleteChat(id: string): Promise<boolean> {
  const resp = await fetch(`/api/chats/${id}`, { method: 'DELETE' });
  return resp.ok;
}

export async function searchMessages(q: string): Promise<SearchResult[]> {
  const resp = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
  if (!resp.ok) return [];
  return resp.json();
}

export async function fetchModels(): Promise<ModelInfo[]> {
  try {
    const resp = await fetch('/api/models');
    if (!resp.ok) return [];
    return resp.json();
  } catch {
    return [];
  }
}

export async function fetchUsername(): Promise<string> {
  try {
    const resp = await fetch('/whoami');
    const text = await resp.text();
    return text.trim() || 'web';
  } catch {
    return 'web';
  }
}

interface StreamCallbacks {
  onChunk: (accumulated: string) => void;
  onDone: (full: string) => void;
  onError: (message: string) => void;
}

export async function streamChat(
  messages: ChatMessage[],
  model: Model,
  username: string,
  callbacks: StreamCallbacks,
): Promise<void> {
  let resp: Response;
  try {
    const now = new Date().toLocaleString('en-US', {
      timeZone: 'Asia/Taipei',
      dateStyle: 'full',
      timeStyle: 'short',
    });
    const instructions = `The current date and time is ${now} (Asia/Taipei, UTC+8).`;

    // Build /v1/responses input array
    const input = messages.map((m) => {
      if (typeof m.content === 'string') {
        return { type: 'message', role: m.role, content: m.content };
      }
      // Multimodal content blocks (input_text + input_image)
      return { type: 'message', role: m.role, content: m.content };
    });

    resp = await fetch('/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: true,
        instructions,
        input,
        user: 'askclaw-' + username,
      }),
    });
  } catch {
    callbacks.onError('network');
    return;
  }

  if (!resp.ok) {
    callbacks.onError(String(resp.status));
    return;
  }

  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop()!;

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data);
        // /v1/responses streaming: text deltas arrive in parsed.delta
        const delta = parsed.delta;
        if (typeof delta === 'string') {
          full += delta;
          callbacks.onChunk(full);
        }
      } catch {
        // ignore malformed SSE chunks
      }
    }
  }

  callbacks.onDone(full);
}
