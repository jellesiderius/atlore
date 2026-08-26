import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import Redis from 'ioredis';
import { WebSocketServer } from 'ws';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_REALTIME_BYTES = 256 * 1024;

/**
 * @typedef {{ userId: string, userName: string, userColor: string, campaignId: string, canEdit: boolean, canWrite: boolean, expiresAt: number }} RealtimeClaims
 * @typedef {import('ws').WebSocket & {
 *   claims: RealtimeClaims,
 *   connectionId: string,
 *   messageSequence: number,
 *   messageWindowStartedAt: number,
 *   messageWindowCount: number,
 *   lastPresenceSessionId: string | null,
 *   lastPresenceNodeId: string | null,
 *   isAlive: boolean
 * }} RealtimeClient
 */

/**
 * Hang de Atlore-campaignsocket aan een bestaande HTTP-server. Hierdoor gebruikt
 * Vite-dev exact dezelfde realtime-laag als de production adapter-node server.
 *
 * @param {import('node:http').Server} server
 */
export async function attachRealtime(server) {
  const secret = process.env.REALTIME_SECRET || '';
  const websocket = new WebSocketServer({ noServer: true, clientTracking: true });
  /** @type {Map<string, Set<RealtimeClient>>} */
  const rooms = new Map();
  /** @type {Redis | null} */
  let subscriber = null;
  /** @type {Redis | null} */
  let publisher = null;
  let closed = false;

  /** @param {unknown} token */
  function verifyToken(token) {
    const [payload, signature] = String(token || '').split('.');
    if (!payload || !signature || secret.length < 32) return null;
    const expected = createHmac('sha256', secret).update(payload).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    try {
      const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
      return claims.expiresAt > Date.now() &&
        typeof claims.campaignId === 'string' &&
        UUID.test(claims.campaignId) &&
        typeof claims.userId === 'string' &&
        UUID.test(claims.userId) &&
        typeof claims.userName === 'string' &&
        claims.userName.length > 0 &&
        claims.userName.length <= 80 &&
        typeof claims.userColor === 'string' &&
        /^#[0-9a-f]{6}$/i.test(claims.userColor) &&
        typeof claims.canEdit === 'boolean' &&
        typeof claims.canWrite === 'boolean'
        ? /** @type {RealtimeClaims} */ (claims)
        : null;
    } catch {
      return null;
    }
  }

  /** @param {unknown} body */
  function validBody(body) {
    if (!Array.isArray(body) || body.length > 2_000) return false;
    let characters = 0;
    for (const paragraph of body) {
      if (!paragraph || !Array.isArray(paragraph.segs) || paragraph.segs.length > 2_000)
        return false;
      for (const segment of paragraph.segs) {
        if (!segment || typeof segment !== 'object') return false;
        if (segment.t === 'txt' && typeof segment.v === 'string') {
          if (segment.v.length > 100_000) return false;
          characters += segment.v.length;
        } else if (
          segment.t !== 'ref' ||
          typeof segment.id !== 'string' ||
          !UUID.test(segment.id)
        ) {
          return false;
        }
        if (characters > 200_000) return false;
      }
    }
    return true;
  }

  /**
   * @param {string} campaignId
   * @param {unknown} message
   * @param {string} [excludeConnectionId]
   */
  function broadcast(campaignId, message, excludeConnectionId = '') {
    const encoded = JSON.stringify(message);
    for (const client of rooms.get(campaignId) || []) {
      if (client.connectionId !== excludeConnectionId && client.readyState === 1)
        client.send(encoded);
    }
  }

  /**
   * @param {import('node:http').IncomingMessage} request
   * @param {import('node:stream').Duplex} socket
   * @param {Buffer} head
   */
  const upgrade = (request, socket, head) => {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    if (url.pathname !== '/realtime') return;
    const claims = verifyToken(url.searchParams.get('token'));
    if (!claims) return socket.destroy();
    websocket.handleUpgrade(request, socket, head, (websocketClient) => {
      const client = /** @type {RealtimeClient} */ (websocketClient);
      client.claims = claims;
      websocket.emit('connection', client);
    });
  };
  server.on('upgrade', upgrade);

  websocket.on('connection', (websocketClient) => {
    const client = /** @type {RealtimeClient} */ (websocketClient);
    const campaignId = client.claims.campaignId;
    client.connectionId = randomUUID();
    client.messageSequence = 0;
    client.messageWindowStartedAt = Date.now();
    client.messageWindowCount = 0;
    client.lastPresenceSessionId = null;
    client.lastPresenceNodeId = null;
    client.isAlive = true;
    const room = rooms.get(campaignId) || new Set();
    room.add(client);
    rooms.set(campaignId, room);
    client.send(JSON.stringify({ type: 'ready', campaignId }));
    client.on('message', (raw, isBinary) => {
      const encoded = raw.toString();
      if (isBinary || Buffer.byteLength(encoded) > MAX_REALTIME_BYTES) return;
      const now = Date.now();
      if (now - client.messageWindowStartedAt >= 1_000) {
        client.messageWindowStartedAt = now;
        client.messageWindowCount = 0;
      }
      client.messageWindowCount += 1;
      if (client.messageWindowCount > 30) return;

      let input;
      try {
        input = JSON.parse(encoded);
      } catch {
        return;
      }
      if (
        input?.type === 'session:presence' &&
        UUID.test(input.sessionId) &&
        (input.offset === null ||
          (Number.isInteger(input.offset) && input.offset >= 0 && input.offset <= 200_000))
      ) {
        client.lastPresenceSessionId = input.offset === null ? null : input.sessionId;
        publish({
          type: 'session:presence',
          sessionId: input.sessionId,
          offset: input.offset,
          revision: `${client.connectionId}:${++client.messageSequence}`,
          userId: client.claims.userId,
          userName: client.claims.userName,
          userColor: client.claims.userColor,
          senderConnectionId: client.connectionId,
          at: now
        });
        return;
      }
      if (
        input?.type === 'node:presence' &&
        UUID.test(input.nodeId) &&
        (input.offset === null ||
          (Number.isInteger(input.offset) && input.offset >= 0 && input.offset <= 200_000))
      ) {
        client.lastPresenceNodeId = input.offset === null ? null : input.nodeId;
        publish({
          type: 'node:presence',
          nodeId: input.nodeId,
          offset: input.offset,
          revision: `${client.connectionId}:${++client.messageSequence}`,
          userId: client.claims.userId,
          userName: client.claims.userName,
          userColor: client.claims.userColor,
          senderConnectionId: client.connectionId,
          at: now
        });
        return;
      }
      if (
        client.claims.canEdit === true &&
        input?.type === 'node:draft' &&
        UUID.test(input.nodeId) &&
        validBody(input.body)
      ) {
        publish({
          type: 'node:draft',
          nodeId: input.nodeId,
          body: input.body,
          revision: `${client.connectionId}:${++client.messageSequence}`,
          userId: client.claims.userId,
          userName: client.claims.userName,
          senderConnectionId: client.connectionId,
          at: now
        });
        return;
      }
      if (
        client.claims.canWrite !== true ||
        input?.type !== 'session:draft' ||
        !UUID.test(input.sessionId) ||
        !validBody(input.body)
      )
        return;

      const message = {
        type: 'session:draft',
        sessionId: input.sessionId,
        body: input.body,
        revision: `${client.connectionId}:${++client.messageSequence}`,
        userId: client.claims.userId,
        userName: client.claims.userName,
        senderConnectionId: client.connectionId,
        at: now
      };
      publish(message);
    });
    client.on('pong', () => (client.isAlive = true));
    client.on('close', () => {
      if (client.lastPresenceSessionId) {
        publish({
          type: 'session:presence',
          sessionId: client.lastPresenceSessionId,
          offset: null,
          revision: `${client.connectionId}:${++client.messageSequence}`,
          userId: client.claims.userId,
          userName: client.claims.userName,
          userColor: client.claims.userColor,
          senderConnectionId: client.connectionId,
          at: Date.now()
        });
      }
      if (client.lastPresenceNodeId) {
        publish({
          type: 'node:presence',
          nodeId: client.lastPresenceNodeId,
          offset: null,
          revision: `${client.connectionId}:${++client.messageSequence}`,
          userId: client.claims.userId,
          userName: client.claims.userName,
          userColor: client.claims.userColor,
          senderConnectionId: client.connectionId,
          at: Date.now()
        });
      }
      room.delete(client);
      if (!room.size) rooms.delete(campaignId);
    });
    client.on('error', () => undefined);

    /** @param {unknown} message */
    function publish(message) {
      if (publisher) {
        publisher
          .publish(`atlore:campaign:${campaignId}`, JSON.stringify(message))
          .catch(() => broadcast(campaignId, message, client.connectionId));
      } else broadcast(campaignId, message, client.connectionId);
    }
  });

  if (process.env.REDIS_URL) {
    subscriber = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1 });
    publisher = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1 });
    subscriber.on('error', (error) => console.error('[realtime] Redis:', error.message));
    publisher.on('error', (error) => console.error('[realtime] Redis publisher:', error.message));
    await subscriber.psubscribe('atlore:campaign:*');
    subscriber.on('pmessage', (_pattern, channel, message) => {
      const campaignId = channel.slice('atlore:campaign:'.length);
      try {
        const payload = JSON.parse(message);
        if (
          payload?.type === 'session:draft' ||
          payload?.type === 'session:presence' ||
          payload?.type === 'node:draft' ||
          payload?.type === 'node:presence'
        )
          broadcast(campaignId, payload, payload.senderConnectionId);
        else broadcast(campaignId, { type: 'invalidate', ...payload });
      } catch {
        // Ongeldige interne pub/sub-berichten worden niet doorgestuurd.
      }
    });
  }

  const heartbeat = setInterval(() => {
    for (const websocketClient of websocket.clients) {
      const client = /** @type {RealtimeClient} */ (websocketClient);
      if (client.isAlive === false) {
        client.terminate();
        continue;
      }
      client.isAlive = false;
      client.ping();
    }
  }, 30_000);

  return {
    async close() {
      if (closed) return;
      closed = true;
      clearInterval(heartbeat);
      server.off('upgrade', upgrade);
      for (const client of websocket.clients) client.terminate();
      websocket.close();
      await Promise.allSettled([subscriber?.quit(), publisher?.quit()].filter(Boolean));
    }
  };
}
