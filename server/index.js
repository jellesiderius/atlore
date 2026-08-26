import 'dotenv/config';
import { createServer } from 'node:http';
import { handler } from '../build/handler.js';
import { attachRealtime } from './realtime.js';

const port = Number(process.env.PORT || 3000);
const server = createServer(handler);
const realtime = await attachRealtime(server);

server.listen(port, '0.0.0.0', () => console.info(`[atlore] listening on :${port}`));

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    void realtime.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
