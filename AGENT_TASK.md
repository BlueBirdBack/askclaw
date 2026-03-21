# Task: Implement proper file upload pipeline for AskClaw IM

## Context
AskClaw IM currently sends images as base64 inside JSON → NATS → relay → gateway.
This is fragile (NATS 8MB limit, gateway 5MB limit) and wastes bandwidth.
We need a server-side upload flow like askclaw.top uses.

## Architecture

```
Browser → POST /bridge/upload (FormData) → Bridge stores file on disk → returns {id, url, filename, content_type, size}
Browser → POST /bridge/send (JSON with attachment_ids or file metadata) → Bridge → NATS → Relay → Gateway
Browser → GET /bridge/files/:id → Bridge serves file from disk
```

## Changes needed

### 1. Bridge (`bridge-nats.cjs`) — add upload + serve endpoints

Add to the bridge:

**`POST /bridge/upload`** — multipart FormData upload
- Accept `files` field (multipart)  
- Store each file to `/opt/askclaw-im-bridge/uploads/<uuid>.<ext>`
- Create uploads dir on startup if not exists
- Return JSON array: `[{id, filename, content_type, size, url}]`
- Limit: 10MB per file, 5 files max per request
- Require auth (checkAuth)

**`GET /bridge/files/:id`** — serve uploaded files
- Look up file by ID from in-memory map (or simple JSON file)
- Serve with correct Content-Type
- Require auth (checkAuth)

For the file metadata store: use a simple in-memory Map keyed by file ID.
Files are ephemeral (session-scoped) — no need for a database.
On startup, clean old uploads > 24h.

For multipart parsing: use NO external dependencies. Parse the multipart boundary manually
or use a minimal approach. The `http` module gives us raw request data.
Actually, simplest approach: use Node's built-in capabilities.

Here's a clean multipart parser pattern for Node without deps:

```js
function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';
    const match = contentType.match(/boundary=(?:"([^"]+)"|([^\s;]+))/);
    if (!match) return reject(new Error('no boundary'));
    const boundary = match[1] || match[2];
    
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > 50 * 1024 * 1024) { // 50MB total limit
        req.destroy();
        reject(new Error('too large'));
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const buf = Buffer.concat(chunks);
      const files = [];
      const sep = Buffer.from('--' + boundary);
      let pos = 0;
      
      while (true) {
        const start = buf.indexOf(sep, pos);
        if (start === -1) break;
        pos = start + sep.length;
        
        // Check for closing boundary
        if (buf[pos] === 0x2d && buf[pos + 1] === 0x2d) break; // "--"
        
        // Skip CRLF after boundary
        if (buf[pos] === 0x0d) pos++;
        if (buf[pos] === 0x0a) pos++;
        
        // Find header/body separator (double CRLF)
        const headerEnd = buf.indexOf(Buffer.from('\r\n\r\n'), pos);
        if (headerEnd === -1) break;
        
        const headerStr = buf.slice(pos, headerEnd).toString('utf8');
        const bodyStart = headerEnd + 4;
        
        // Find next boundary
        const nextBoundary = buf.indexOf(sep, bodyStart);
        if (nextBoundary === -1) break;
        
        // Body ends 2 bytes before next boundary (CRLF)
        let bodyEnd = nextBoundary - 2;
        if (bodyEnd < bodyStart) bodyEnd = bodyStart;
        
        const body = buf.slice(bodyStart, bodyEnd);
        
        // Parse headers
        const nameMatch = headerStr.match(/name="([^"]+)"/);
        const filenameMatch = headerStr.match(/filename="([^"]+)"/);
        const ctMatch = headerStr.match(/Content-Type:\s*(.+)/i);
        
        if (filenameMatch) {
          files.push({
            fieldname: nameMatch?.[1] || 'file',
            filename: filenameMatch[1],
            contentType: ctMatch?.[1]?.trim() || 'application/octet-stream',
            data: body,
          });
        }
      }
      
      resolve(files);
    });
    req.on('error', reject);
  });
}
```

**Upload handler:**
```js
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
const MAX_FILES = 5;
const fileStore = new Map(); // id → {filename, contentType, size, storagePath}

// On startup:
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

async function handleUpload(req, res) {
  if (!checkAuth(req)) return json(res, 401, { error: 'unauthorized' });
  
  let files;
  try { files = await parseMultipart(req); } catch (e) { return json(res, 400, { error: e.message }); }
  
  if (files.length === 0) return json(res, 400, { error: 'no files' });
  if (files.length > MAX_FILES) return json(res, 400, { error: `max ${MAX_FILES} files` });
  
  const results = [];
  for (const f of files) {
    if (f.data.length > MAX_FILE_SIZE) return json(res, 400, { error: `file too large: ${f.filename}` });
    
    const id = crypto.randomUUID();
    const ext = path.extname(f.filename) || '.bin';
    const storageName = `${id}${ext}`;
    const storagePath = path.join(UPLOAD_DIR, storageName);
    
    fs.writeFileSync(storagePath, f.data);
    
    fileStore.set(id, {
      filename: f.filename,
      contentType: f.contentType,
      size: f.data.length,
      storagePath,
    });
    
    results.push({
      id,
      filename: f.filename,
      content_type: f.contentType,
      size: f.data.length,
      url: `/bridge/files/${id}`,
    });
  }
  
  json(res, 201, results);
}

async function handleFileServe(req, res) {
  if (!checkAuth(req)) return json(res, 401, { error: 'unauthorized' });
  
  const id = path.pathname.split('/').pop();
  const meta = fileStore.get(id);
  if (!meta || !fs.existsSync(meta.storagePath)) return json(res, 404, { error: 'not found' });
  
  cors(res);
  res.writeHead(200, {
    'Content-Type': meta.contentType,
    'Content-Length': meta.size,
    'Content-Disposition': `inline; filename="${meta.filename}"`,
    'Cache-Control': 'private, max-age=86400',
  });
  fs.createReadStream(meta.storagePath).pipe(res);
}
```

Add routes:
```js
if (path === '/bridge/upload' && req.method === 'POST') return await handleUpload(req, res);
if (path.startsWith('/bridge/files/') && req.method === 'GET') return await handleFileServe(req, res, path);
```

Add to requires at top:
```js
const path = require('path');
const crypto = require('crypto');
```

### 2. Frontend — add upload-before-send flow

**`src/lib/api.ts`** — add uploadFiles function:
```ts
export async function uploadFiles(files: File[], token: string): Promise<UploadedFile[]> {
  const formData = new FormData()
  for (const f of files) {
    formData.append('files', f)
  }
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  
  const resp = await fetch('/bridge/upload', {
    method: 'POST',
    body: formData,
    headers,
  })
  if (!resp.ok) throw new Error(`Upload failed: ${resp.status}`)
  return resp.json()
}

export interface UploadedFile {
  id: string
  filename: string
  content_type: string
  size: number
  url: string
}
```

**`src/lib/stores/chat.ts`** — modify sendMessage flow:

Change the flow to:
1. Wait for compressions (`pendingFile.ready`)
2. Upload all files via `uploadFiles()` 
3. Store server URLs in the user message attachments for display
4. For images: read base64 and send to bridge/NATS for LLM (small after compression)
5. For text files: read as text, inline in the message
6. For other files: just mention as annotation text

The key change: user message attachments now store SERVER URLs (`/bridge/files/<id>`) for display,
not data URLs. This keeps messages lightweight.

For the LLM request, images still go as base64 in the `files` array to the bridge,
but we could also have the relay read them from the upload URL. For simplicity,
keep base64 for LLM but use server URLs for display.

**`src/lib/compress.ts`** — already copied from askclaw.top, uses `OffscreenCanvas` +
`createImageBitmap` to compress images to JPEG ≤2048px, quality 0.85, skip if already <500KB.

**`src/lib/stores/chat.ts`** — add `MessageAttachment` handling:
The `MessageAttachment` type already exists with `{name, type, url}`.
Change `prepareMessagePayload` to:
1. Accept an optional `uploadedFiles` parameter (server responses)
2. Build attachments from server URLs
3. Still read base64 for LLM delivery

### 3. Composer — add compression + file validation

Port the compression and file validation from askclaw.top's ChatInput.svelte.
The IM Composer (`src/lib/components/Composer.svelte`) already has file handling
but doesn't compress images. Add:
- Import `compressImage` from compress.ts
- On image add: start background compression, store `ready` promise
- Show preview URL immediately (from original file)

## Files to modify
1. `/opt/work/askclaw-im/bridge-nats.cjs` — upload/serve endpoints
2. `/opt/work/askclaw-im/src/lib/api.ts` — uploadFiles function  
3. `/opt/work/askclaw-im/src/lib/stores/chat.ts` — upload-before-send flow
4. `/opt/work/askclaw-im/src/lib/components/Composer.svelte` — image compression
5. `/opt/work/askclaw-im/src/lib/components/Message.svelte` — render server URL images
6. `/opt/work/askclaw-im/src/lib/compress.ts` — already copied, just verify it's there

## Important constraints
- NO new npm dependencies for the bridge (parse multipart manually)
- Bridge file store is in-memory (Map) — files are ephemeral
- Max 10MB per file, 5 files per upload, 50MB total request
- Image compression happens client-side before upload
- The existing base64-to-gateway pipeline for LLM still works as fallback
- The display path uses server URLs, the LLM path uses base64
- Don't break existing text-only chat flow
- Test: `npm run build` must succeed after changes

## Reference files
- askclaw.top's upload handler: `/opt/work/askclaw-gh/server/askclaw/routers/files.py`
- askclaw.top's compress: `/opt/work/askclaw-gh/src/lib/compress.ts` (already copied)
- askclaw.top's ChatInput: `/opt/work/askclaw-gh/src/components/ChatInput.svelte`
- askclaw.top's types: `/opt/work/askclaw-gh/src/lib/types.ts`
- Current bridge: `/opt/work/askclaw-im/bridge-nats.cjs`
- Current chat store: `/opt/work/askclaw-im/src/lib/stores/chat.ts`
- Current api: `/opt/work/askclaw-im/src/lib/api.ts`
- Current Composer: `/opt/work/askclaw-im/src/lib/components/Composer.svelte`
- Current Message: `/opt/work/askclaw-im/src/lib/components/Message.svelte`
