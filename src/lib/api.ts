import type { ChatMessage, Model } from './types';

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
  messages: { role: string; content: string }[],
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
  messages: { id: number; role: string; content: string; created_at: string }[];
}

export async function fetchChat(id: string): Promise<ChatDetail | null> {
  const resp = await fetch(`/api/chats/${id}`);
  if (!resp.ok) return null;
  return resp.json();
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
    const systemMsg = { role: 'system' as const, content: `The current date and time is ${now} (Asia/Taipei, UTC+8).` };

    resp = await fetch('/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: true,
        messages: [systemMsg, ...messages],
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
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
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
