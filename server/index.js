import 'dotenv/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { handler } from '../build/handler.js';
import Redis from 'ioredis';
import { WebSocketServer } from 'ws';

const port = Number(process.env.PORT || 3000);
const secret = process.env.REALTIME_SECRET || '';
const server = createServer(handler);
const websocket = new WebSocketServer({ noServer: true, clientTracking: true });
const rooms = new Map();

function verifyToken(token) {
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature || secret.length < 32) return null;
  const expected = createHmac('sha256', secret).update(payload).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return claims.expiresAt > Date.now() && claims.campaignId && claims.userId ? claims : null;
  } catch {
    return null;
  }
}

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  if (url.pathname !== '/realtime') return socket.destroy();
  const claims = verifyToken(url.searchParams.get('token'));
  if (!claims) return socket.destroy();
  websocket.handleUpgrade(request, socket, head, (client) => {
    client.claims = claims;
    websocket.emit('connection', client);
  });
});

websocket.on('connection', (client) => {
  const campaignId = client.claims.campaignId;
  const room = rooms.get(campaignId) || new Set();
  room.add(client);
  rooms.set(campaignId, room);
  client.send(JSON.stringify({ type: 'ready', campaignId }));
  client.on('close', () => {
    room.delete(client);
    if (!room.size) rooms.delete(campaignId);
  });
  client.on('error', () => undefined);
});

if (process.env.REDIS_URL) {
  const subscriber = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1 });
  subscriber.on('error', (error) => console.error('[realtime] Redis:', error.message));
  await subscriber.psubscribe('atlore:campaign:*');
  subscriber.on('pmessage', (_pattern, channel, message) => {
    const campaignId = channel.slice('atlore:campaign:'.length);
    for (const client of rooms.get(campaignId) || []) {
      if (client.readyState === 1)
        client.send(JSON.stringify({ type: 'invalidate', ...JSON.parse(message) }));
    }
  });
}

const heartbeat = setInterval(() => {
  for (const client of websocket.clients) {
    if (client.isAlive === false) return client.terminate();
    client.isAlive = false;
    client.ping();
  }
}, 30_000);
websocket.on('connection', (client) => {
  client.isAlive = true;
  client.on('pong', () => (client.isAlive = true));
});

server.listen(port, '0.0.0.0', () => console.info(`[atlore] listening on :${port}`));

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    clearInterval(heartbeat);
    websocket.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
