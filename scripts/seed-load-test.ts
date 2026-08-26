import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { BUILTIN_NODE_TYPES, OPEN_RIGHTS } from '../src/lib/domain/constants.js';
import { db, pool } from '../src/lib/server/db/index.js';
import {
  campaignMembers,
  campaigns,
  links,
  nodes,
  nodeTypes,
  users
} from '../src/lib/server/db/schema.js';

const email = (process.env.LOAD_TEST_EMAIL || 'demo@atlore.app').trim().toLowerCase();
const nodeCount = Number.parseInt(process.env.LOAD_TEST_NODES || '10000', 10);
const title = `Loadtest · ${nodeCount.toLocaleString('nl-NL')} nodes`;
const batchSize = 500;

if (!Number.isInteger(nodeCount) || nodeCount < 100 || nodeCount > 50_000) {
  throw new Error('LOAD_TEST_NODES moet een geheel getal tussen 100 en 50.000 zijn.');
}

try {
  const [owner] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(sql`lower(${users.email})`, email))
    .limit(1);
  if (!owner) throw new Error(`Account ${email} bestaat niet.`);

  const [existing] = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(and(eq(campaigns.createdBy, owner.id), eq(campaigns.title, title)))
    .limit(1);
  if (existing) {
    const [counts] = await db
      .select({ nodes: sql<number>`count(*)::int` })
      .from(nodes)
      .where(eq(nodes.campaignId, existing.id));
    if (counts.nodes !== nodeCount) {
      throw new Error(
        `Bestaande loadtest bevat ${counts.nodes} nodes in plaats van ${nodeCount}; hernoem of verwijder die campagne eerst.`
      );
    }
    console.info(`Loadtest bestaat al: http://localhost:5173/campaigns/${existing.id}`);
  } else {
    const campaignId = randomUUID();
    const ids = Array.from({ length: nodeCount }, () => randomUUID());
    const typeKeys = BUILTIN_NODE_TYPES.map((type) => type.key);

    await db.transaction(async (tx) => {
      await tx.insert(campaigns).values({
        id: campaignId,
        title,
        system: 'Atlore performance test',
        note: `${nodeCount.toLocaleString('nl-NL')} nodes in 100 verbonden clusters.`,
        rights: OPEN_RIGHTS,
        createdBy: owner.id
      });
      await tx.insert(campaignMembers).values({ campaignId, userId: owner.id, role: 'gm' });
      await tx.insert(nodeTypes).values(
        BUILTIN_NODE_TYPES.map((type) => ({
          campaignId,
          key: type.key,
          pluralName: type.nl,
          singularName: type.one,
          colorDark: type.colorDark,
          colorLight: type.colorLight,
          custom: false
        }))
      );

      for (let start = 0; start < nodeCount; start += batchSize) {
        const values = [];
        for (let index = start; index < Math.min(start + batchSize, nodeCount); index++) {
          const cluster = Math.floor(index / 100);
          const local = index % 100;
          const clusterX = cluster % 10;
          const clusterY = Math.floor(cluster / 10);
          const localX = local % 10;
          const localY = Math.floor(local / 10);
          values.push({
            id: ids[index],
            campaignId,
            typeKey: typeKeys[cluster % typeKeys.length],
            title: `Load node ${String(index + 1).padStart(5, '0')}`,
            size: local === 0 ? ('l' as const) : local % 10 === 0 ? ('m' as const) : ('s' as const),
            summary: `Node ${index + 1} · cluster ${cluster + 1}`,
            x: clusterX * 440 + localX * 34 + ((index * 17) % 7),
            y: clusterY * 440 + localY * 34 + ((index * 29) % 7),
            pinned: false,
            createdBy: owner.id,
            updatedBy: owner.id
          });
        }
        await tx.insert(nodes).values(values);
      }

      const linkValues: (typeof links.$inferInsert)[] = [];
      for (let index = 0; index < nodeCount; index++) {
        const local = index % 100;
        if (local > 0) {
          linkValues.push({
            id: randomUUID(),
            campaignId,
            sourceId: ids[index - 1],
            targetId: ids[index],
            relation: 'related_to',
            createdBy: owner.id
          });
        } else if (index > 0) {
          linkValues.push({
            id: randomUUID(),
            campaignId,
            sourceId: ids[index - 100],
            targetId: ids[index],
            relation: 'related_to',
            createdBy: owner.id
          });
        }
        if (local >= 10) {
          linkValues.push({
            id: randomUUID(),
            campaignId,
            sourceId: ids[index - 10],
            targetId: ids[index],
            relation: 'related_to',
            createdBy: owner.id
          });
        }
      }
      for (let start = 0; start < linkValues.length; start += 1000) {
        await tx.insert(links).values(linkValues.slice(start, start + 1000));
      }
    });

    console.info(
      `Loadtest klaar: ${nodeCount} nodes, ${nodeCount - 1 + Math.max(0, nodeCount - Math.ceil(nodeCount / 100) * 10)} links.`
    );
    console.info(`Open: http://localhost:5173/campaigns/${campaignId}`);
  }
} finally {
  await pool.end();
}
