#!/usr/bin/env node
/**
 * AskClaw IM Bridge
 *
 * HTTP/SSE server that translates browser requests into NATS messages.
 * Each agent has a relay on its VPS that handles the actual gateway connection.
 *
 *   Browser → HTTPS → nginx → Bridge (this) → NATS → Relay → Gateway → Agent
 *                                                ← NATS ← Relay ← Gateway ←
 *                                    Bridge → SSE → Browser
 */

'use strict';

const http = require('http');
const fs   = require('fs');
const { connect, StringCodec, createInbox } = require('nats');

const PORT        = parseInt(process.env.PORT || '18795', 10);
const BIND_HOST    = process.env.BIND_HOST || '127.0.0.1';
const AUTH_TOKEN   = process.env.AUTH_TOKEN || '';
const NATS_URL     = process.env.NATS_URL   || 'tls://127.0.0.1:4222';
const NATS_USER      = process.env.NATS_USER  || '';
const NATS_PASS      = process.env.NATS_PASS  || '';
const NATS_CA      = process.env.NATS_CA    || '/etc/nats/certs/ca.pem';
const CORS_ORIGIN  = process.env.CORS_ORIGIN || '';
const AGENTS_FILE  = process.env.AGENTS_FILE || './agents.json';

const sc = StringCodec();
let nc = null;
let agents = {};

function log(...args) {
  console.log(new Date().toISOString(), '[bridge]', ...args);
}

function loadAgents() {
  try {
    agents = JSON.parse(fs.readFileSync(AGENTS_FILE, 'utf8'));
    log('Loaded agents:', Object.keys(agents).join(', '));
  } catch (e) {
    log('Failed to load agents.json:', e.message);
  }
}

function checkAuth(req) {
  if (!AUTH_TOKEN) return true;  // no token configured = self-hosted trusted mode
  return (req.headers['authorization'] || '') === `Bearer ${AUTH_TOKEN}`;
}

function cors(res) {
  if (!CORS_ORIGIN) return;

  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');
}

function json(res, code, data) {
  cors(res);
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function sanitizeSseData(data) {
  return String(data).replace(/[\r\n]/g, ' ');
}

function writeSseData(res, data) {
  res.write(`data: ${sanitizeSseData(data)}\n\n`);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('request timeout'));
    }, 30000);

    req.on('data', c => {
      if (settled) return;
      body += c;
      if (body.length > 10 * 1024 * 1024) {  // 10MB — base64 images are large
        settled = true;
        clearTimeout(timeout);
        reject(new Error('too large'));
      }
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try { resolve(JSON.parse(body)); } catch { reject(new Error('invalid json')); }
    });
    req.on('error', err => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(err);
    });
  });
}

/* ── Routes ── */

async function handleHealth(req, res) {
  json(res, 200, {
    status: nc ? 'ok' : 'nats_disconnected',
    agents: Object.keys(agents).map(id => ({
      id, label: agents[id].label, emoji: agents[id].emoji
    })),
    authRequired: Boolean(AUTH_TOKEN),
    uptime: Math.floor(process.uptime()),
    ts: Date.now()
  });
}

async function handleAgents(req, res) {
  if (!checkAuth(req)) return json(res, 401, { error: 'unauthorized' });

  const list = Object.entries(agents).map(([id, a]) => ({
    id, label: a.label, emoji: a.emoji
  }));
  json(res, 200, list);
}

async function handleSend(req, res) {
  if (!checkAuth(req)) return json(res, 401, { error: 'unauthorized' });
  if (!nc) return json(res, 503, { error: 'NATS not connected' });

  let body;
  try { body = await readBody(req); } catch (e) { return json(res, 400, { error: e.message }); }

  const agentId = body.agent || 'ash';
  const text    = body.text;
  if (!text) return json(res, 400, { error: 'missing text' });
  if (!agents[agentId]) return json(res, 400, { error: `unknown agent: ${agentId}` });

  const subject = `askclaw.chat.${agentId}.request`;
  const inbox   = createInbox();

  // Set up SSE response
  cors(res);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  // Subscribe to reply inbox
  const sub = nc.subscribe(inbox, { max: 100 });
  let done = false;
  const timeout = setTimeout(() => {
    if (!done) {
      writeSseData(res, JSON.stringify({ error: 'timeout' }));
      writeSseData(res, '[DONE]');
      res.end();
      done = true;
      sub.unsubscribe();
    }
  }, 120000); // 2 min timeout

  // Build NATS payload — include files/attachments if present
  const natsPayload = { type: 'send', text };
  if (Array.isArray(body.files) && body.files.length > 0) {
    natsPayload.files = body.files;
  }

  // Publish request to NATS with reply subject
  nc.publish(subject, sc.encode(JSON.stringify(natsPayload)), { reply: inbox });
  log(`→ ${subject}: "${text.substring(0, 50)}..."${natsPayload.files ? ` [${natsPayload.files.length} file(s)]` : ''}`);

  // Stream replies back as SSE
  (async () => {
    for await (const msg of sub) {
      if (done) break;
      const raw = sc.decode(msg.data);
      if (raw === '[DONE]') {
        if (!res.writableEnded) {
          writeSseData(res, '[DONE]');
          res.end();
        }
        done = true;
        clearTimeout(timeout);
        break;
      }
      if (!res.writableEnded) {
        writeSseData(res, raw);
      }
    }
  })().catch(() => {});

  // Clean up on client disconnect
  req.on('close', () => {
    if (!done) {
      done = true;
      sub.unsubscribe();
      clearTimeout(timeout);
    }
  });
}

async function handleHistory(req, res) {
  if (!checkAuth(req)) return json(res, 401, { error: 'unauthorized' });
  if (!nc) return json(res, 503, { error: 'NATS not connected' });

  const url = new URL(req.url, 'http://localhost');
  const agentId = url.searchParams.get('agent') || 'ash';
  if (!agents[agentId]) return json(res, 400, { error: `unknown agent: ${agentId}` });

  const subject = `askclaw.chat.${agentId}.request`;
  const inbox   = createInbox();

  const sub = nc.subscribe(inbox, { max: 1 });
  nc.publish(subject, sc.encode(JSON.stringify({ type: 'history' })), { reply: inbox });

  const timer = setTimeout(() => sub.drain(), 10000);
  try {
    for await (const msg of sub) {
      clearTimeout(timer);
      const data = JSON.parse(sc.decode(msg.data));
      return json(res, 200, data);
    }

    clearTimeout(timer);
    if (!res.writableFinished) return json(res, 504, { error: 'relay timeout' });
  } catch (e) {
    clearTimeout(timer);
    if (!res.writableFinished) return json(res, 500, { error: e.message });
  }
}

async function handleNew(req, res) {
  if (!checkAuth(req)) return json(res, 401, { error: 'unauthorized' });
  if (!nc) return json(res, 503, { error: 'NATS not connected' });

  let body;
  try { body = await readBody(req); } catch (e) { return json(res, 400, { error: e.message }); }

  const agentId = body.agent || 'ash';
  if (!agents[agentId]) return json(res, 400, { error: `unknown agent: ${agentId}` });

  const subject = `askclaw.chat.${agentId}.request`;
  const inbox   = createInbox();

  const sub = nc.subscribe(inbox, { max: 1 });
  nc.publish(subject, sc.encode(JSON.stringify({ type: 'new' })), { reply: inbox });

  const timer = setTimeout(() => sub.drain(), 10000);
  try {
    for await (const msg of sub) {
      clearTimeout(timer);
      const data = JSON.parse(sc.decode(msg.data));
      return json(res, 200, data);
    }

    if (!res.writableFinished) json(res, 504, { error: 'relay timeout' });
  } catch (e) {
    clearTimeout(timer);
    if (!res.writableFinished) json(res, 500, { error: e.message });
  }
}

/* ── Server ── */

const server = http.createServer(async (req, res) => {
  const url  = new URL(req.url, 'http://localhost');
  const path = url.pathname;

  if (req.method === 'OPTIONS') {
    cors(res);
    res.writeHead(204);
    return res.end();
  }

  try {
    if (path === '/bridge/health'  && req.method === 'GET')  return await handleHealth(req, res);
    if (path === '/bridge/agents'  && req.method === 'GET')  return await handleAgents(req, res);
    if (path === '/bridge/send'    && req.method === 'POST') return await handleSend(req, res);
    if (path === '/bridge/history' && req.method === 'GET')  return await handleHistory(req, res);
    if (path === '/bridge/new'     && req.method === 'POST') return await handleNew(req, res);

    // Chat persistence stubs — frontend expects these, return empty/ok for now
    if (path === '/bridge/chats' && req.method === 'GET') return json(res, 200, []);
    if (path.startsWith('/bridge/chats/') && path.endsWith('/load') && req.method === 'POST') return json(res, 200, { ok: true });
    if (path.startsWith('/bridge/chats/') && req.method === 'GET')    return json(res, 200, { id: 'none', messages: [] });
    if (path.startsWith('/bridge/chats/') && req.method === 'DELETE') return json(res, 200, { ok: true });
    if (path === '/bridge/search' && req.method === 'GET') return json(res, 200, []);

    json(res, 404, { error: 'not found' });
  } catch (e) {
    log('Error:', e.message);
    if (!res.headersSent) json(res, 500, { error: 'internal error' });
  }
});

async function main() {
  loadAgents();

  if (!AUTH_TOKEN) {
    log('⚠️ AUTH_TOKEN not set — running in trusted mode (no authentication). Set AUTH_TOKEN env var to enable auth.');
  }

  // Connect to NATS
  const tlsOpts = {};
  if (NATS_CA && fs.existsSync(NATS_CA)) {
    tlsOpts.ca = fs.readFileSync(NATS_CA);
  }
  // Skip hostname verification for loopback — cert has IP:127.0.0.1 but
  // nats.js may resolve to "localhost" for SNI, causing altname mismatch
  tlsOpts.checkServerIdentity = () => undefined;

  nc = await connect({
    servers: NATS_URL,
    user: NATS_USER,
    pass: NATS_PASS,
    tls: tlsOpts
  });
  log('NATS connected');

  server.listen(PORT, BIND_HOST, () => {
    log(`Bridge listening on http://${BIND_HOST}:${PORT}`);
    log(`Agents: ${Object.keys(agents).join(', ')}`);
  });
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
