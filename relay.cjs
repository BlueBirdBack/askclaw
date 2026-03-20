#!/usr/bin/env node
/**
 * AskClaw IM Relay — bridges NATS ↔ local gateway WebSocket
 * 
 * Runs on each agent's VPS. Subscribes to askclaw.chat.{agent}.request,
 * connects to the local gateway via WebSocket, streams responses back
 * via NATS to the reply subject.
 *
 * Usage:
 *   AGENT=ash GATEWAY_URL=ws://127.0.0.1:18789/ GATEWAY_TOKEN=xxx \
 *   GATEWAY_ORIGIN=https://your-openclaw.example.com NATS_URL=tls://127.0.0.1:4222 \
 *   NATS_USER=myuser NATS_PASS=xxx node relay.js
 */

'use strict';

const WebSocket = require('ws');
const { randomUUID } = require('crypto');
const { connect, StringCodec } = require('nats');
const fs   = require('fs');
const path = require('path');

const AGENT          = process.env.AGENT          || 'ash';
const GATEWAY_URL    = process.env.GATEWAY_URL    || 'ws://127.0.0.1:18789/';
const GATEWAY_TOKEN  = process.env.GATEWAY_TOKEN  || '';
const GATEWAY_ORIGIN = process.env.GATEWAY_ORIGIN || 'http://127.0.0.1:18789';
const NATS_URL       = process.env.NATS_URL       || 'tls://127.0.0.1:4222';
const NATS_USER      = process.env.NATS_USER  || '';
const NATS_PASS      = process.env.NATS_PASS      || '';
const NATS_CA        = process.env.NATS_CA         || '/etc/nats/certs/ca.pem';
const SUBJECT        = `askclaw.chat.${AGENT}.request`;

const sc = StringCodec();
let nc = null;

function log(...args) {
  console.log(new Date().toISOString(), `[relay:${AGENT}]`, ...args);
}

function uuid() {
  return randomUUID();
}

/* ── Gateway WebSocket session ── */
class GatewaySession {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.connecting = false;
    this.pendingRequests = new Map();  // id → {resolve, reject}
    this.activeStream = null;         // {replySubject, runId}
    this.reconnectDelay = 1000;
  }

  connect() {
    if (this.connecting || this.connected) return;
    this.connecting = true;
    log(`Connecting to gateway ${GATEWAY_URL}`);

    const ws = new WebSocket(GATEWAY_URL, {
      headers: { Origin: GATEWAY_ORIGIN }
    });

    ws.on('open', () => {
      log('WS open, sending connect frame');
      const connectId = uuid();
      ws.send(JSON.stringify({
        type: 'req', id: connectId, method: 'connect',
        params: {
          minProtocol: 3, maxProtocol: 3,
          auth: { token: GATEWAY_TOKEN },
          role: 'operator',
          scopes: ['operator.write', 'operator.read'],
          client: { id: 'webchat', displayName: `Relay:${AGENT}`, mode: 'webchat', version: '2.0', platform: 'node' }
        }
      }));
      this.pendingRequests.set(connectId, {
        resolve: () => {
          this.connected = true;
          this.connecting = false;
          this.reconnectDelay = 1000;
          log('Gateway connected');
        },
        reject: (err) => {
          log('Connect rejected:', err.message);
          ws.close();
        }
      });
    });

    ws.on('message', (data) => {
      let msg;
      try { msg = JSON.parse(data.toString()); } catch { return; }

      if (msg.type === 'res') {
        const pending = this.pendingRequests.get(msg.id);
        if (pending) {
          this.pendingRequests.delete(msg.id);
          if (msg.ok) {
            // Store runId for chat.send responses
            if (msg.payload && msg.payload.runId && this.activeStream) {
              this.activeStream.runId = msg.payload.runId;
            }
            pending.resolve(msg.payload);
          } else {
            pending.reject(new Error(msg.error?.message || 'gateway error'));
          }
        }
      } else if (msg.type === 'event' && msg.event === 'chat') {
        this._handleChatEvent(msg.payload);
      }
      // Ignore connect.challenge, health, etc.
    });

    ws.on('close', (code) => {
      log(`WS closed (${code}), reconnecting in ${this.reconnectDelay}ms`);
      this.ws = null;
      this.connected = false;
      this.connecting = false;
      // Reject pending requests
      for (const [, p] of this.pendingRequests) p.reject(new Error('ws closed'));
      this.pendingRequests.clear();
      // Fail active stream
      if (this.activeStream) {
        this._publishReply(this.activeStream.replySubject, { error: 'gateway disconnected' });
        this._publishReply(this.activeStream.replySubject, '[DONE]');
        this.activeStream = null;
      }
      setTimeout(() => this.connect(), this.reconnectDelay);
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 30000);
    });

    ws.on('error', (err) => {
      log('WS error:', err.message);
    });

    this.ws = ws;
  }

  _handleChatEvent(payload) {
    if (!payload || !this.activeStream) return;
    const state = payload.state;
    const text  = extractText(payload.message);
    const stream = this.activeStream;

    if (stream.runId && payload.runId && stream.runId !== payload.runId) return;

    if (state === 'delta') {
      stream.accumulated = text;
      this._publishReply(stream.replySubject, { delta: text });
    } else if (state === 'final') {
      if (text && stream.accumulated === '') {
        this._publishReply(stream.replySubject, { delta: text });
      }
      this._publishReply(stream.replySubject, '[DONE]');
      this.activeStream = null;
    } else if (state === 'aborted' || state === 'error') {
      this._publishReply(stream.replySubject, { error: payload.errorMessage || 'aborted' });
      this._publishReply(stream.replySubject, '[DONE]');
      this.activeStream = null;
    }
  }

  _publishReply(subject, data) {
    if (!nc) return;
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    nc.publish(subject, sc.encode(payload));
  }

  async sendMessage(text, replySubject, files) {
    if (!this.connected || !this.ws) {
      this._publishReply(replySubject, { error: 'gateway not connected' });
      this._publishReply(replySubject, '[DONE]');
      return;
    }

    // Only one stream at a time
    if (this.activeStream) {
      this._publishReply(replySubject, { error: 'busy — another request is in progress' });
      this._publishReply(replySubject, '[DONE]');
      return;
    }

    this.activeStream = { replySubject, runId: null, accumulated: '' };

    const reqId = uuid();
    const sendPromise = new Promise((resolve, reject) => {
      this.pendingRequests.set(reqId, { resolve, reject });
    });

    // Build chat.send params — include attachments if files are present
    const params = {
      sessionKey: 'main',
      message: text,
      idempotencyKey: uuid()
    };

    if (Array.isArray(files) && files.length > 0) {
      // Convert frontend file format → gateway attachment format
      // Frontend sends: { data: base64, name: string, type: mimeType }
      // Gateway expects: { content: base64, fileName: string, mimeType: string }
      params.attachments = files.map(f => ({
        content: f.data,
        fileName: f.name,
        mimeType: f.type
      }));
      log(`Sending ${files.length} attachment(s) to gateway`);
    }

    this.ws.send(JSON.stringify({
      type: 'req', id: reqId, method: 'chat.send',
      params
    }));

    try {
      await sendPromise;
    } catch (err) {
      this._publishReply(replySubject, { error: err.message });
      this._publishReply(replySubject, '[DONE]');
      this.activeStream = null;
    }
  }

  async getHistory(replySubject) {
    if (!this.connected || !this.ws) {
      this._publishReply(replySubject, JSON.stringify({ error: 'gateway not connected' }));
      return;
    }
    const reqId = uuid();
    const promise = new Promise((resolve, reject) => {
      this.pendingRequests.set(reqId, { resolve, reject });
    });
    this.ws.send(JSON.stringify({
      type: 'req', id: reqId, method: 'chat.history', params: {}
    }));
    try {
      const result = await promise;
      this._publishReply(replySubject, JSON.stringify({ ok: true, payload: result }));
    } catch (err) {
      this._publishReply(replySubject, JSON.stringify({ error: err.message }));
    }
  }

  resetSession() {
    // Close and reconnect to get a fresh webchat session
    if (this.ws) {
      this.ws.close();
    }
  }
}

function extractText(message) {
  if (!message) return '';
  const content = message.content;
  if (!Array.isArray(content)) return '';
  return content
    .filter(c => (c.type === 'text' || c.type === 'output_text') && typeof c.text === 'string')
    .map(c => c.text)
    .join('');
}

/* ── Main ── */
async function main() {
  log(`Starting relay for agent "${AGENT}"`);
  log(`NATS: ${NATS_URL}, Subject: ${SUBJECT}`);
  log(`Gateway: ${GATEWAY_URL}`);

  // Connect to NATS
  const tlsOpts = {};
  if (NATS_CA && fs.existsSync(NATS_CA)) {
    tlsOpts.ca = fs.readFileSync(NATS_CA);
  }

  nc = await connect({
    servers: NATS_URL,
    user: NATS_USER,
    pass: NATS_PASS,
    tls: Object.keys(tlsOpts).length > 0 ? tlsOpts : undefined
  });
  log('NATS connected');

  // Connect to gateway
  const gw = new GatewaySession();
  gw.connect();

  // Subscribe to chat requests
  const sub = nc.subscribe(SUBJECT);
  log(`Subscribed to ${SUBJECT}`);

  for await (const msg of sub) {
    const raw = sc.decode(msg.data);
    let req;
    try { req = JSON.parse(raw); } catch { continue; }

    const replySubject = msg.reply || req.replySubject;
    if (!replySubject) {
      log('No reply subject, ignoring');
      continue;
    }

    if (req.type === 'send') {
      const fileCount = Array.isArray(req.files) ? req.files.length : 0;
      log(`Chat request: "${(req.text || '').substring(0, 50)}..."${fileCount ? ` [${fileCount} file(s)]` : ''} → reply ${replySubject}`);
      gw.sendMessage(req.text, replySubject, req.files);
    } else if (req.type === 'history') {
      log('History request');
      gw.getHistory(replySubject);
    } else if (req.type === 'new') {
      log('New session request');
      gw.resetSession();
      nc.publish(replySubject, sc.encode(JSON.stringify({ ok: true })));
    } else {
      log('Unknown request type:', req.type);
    }
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
