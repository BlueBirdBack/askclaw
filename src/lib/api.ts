import type { ChatMessage, Model } from './types';

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
    resp = await fetch('/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: true,
        messages,
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
