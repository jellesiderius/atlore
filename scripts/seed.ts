import 'dotenv/config';
import { and, eq, sql } from 'drizzle-orm';
import { BUILTIN_NODE_TYPES, DEFAULT_RIGHTS } from '../src/lib/domain/constants.js';
import { hashPassword } from '../src/lib/server/auth.js';
import { db, pool } from '../src/lib/server/db/index.js';
import {
  campaignMembers,
  campaigns,
  links,
  nodeDescriptions,
  nodes,
  nodeTypes,
  posts,
  sessionScratch,
  sessions,
  users
} from '../src/lib/server/db/schema.js';
import type { Paragraph } from '../src/lib/types.js';

const DEMO_PASSWORD = process.env.SEED_PASSWORD || 'AtloreDemo!2026';

const P = (...segments: (string | { ref: string })[]): Paragraph => ({
  segs: segments.map((segment) =>
    typeof segment === 'string'
      ? { t: 'txt' as const, v: segment }
      : { t: 'ref' as const, id: segment.ref }
  )
});

const R = (ref: string) => ({ ref });

async function upsertUser(email: string, name: string, color: string) {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(sql`lower(${users.email})`, email.toLowerCase()))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(users)
    .values({
      email,
      name,
      color,
      passwordHash: await hashPassword(DEMO_PASSWORD),
      emailVerifiedAt: new Date()
    })
    .returning();
  return created;
}

async function addTypes(campaignId: string) {
  await db.insert(nodeTypes).values(
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
}

try {
  const demo = await upsertUser('demo@atlore.app', 'Jelle', '#f0913f');
  const lena = await upsertUser('lena@atlore.app', 'Lena', '#7f8ee8');

  const [existing] = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(and(eq(campaigns.createdBy, demo.id), eq(campaigns.title, 'Ember & Rust')))
    .limit(1);

  if (!existing) {
    await db.transaction(async (tx) => {
      const [campaign] = await tx
        .insert(campaigns)
        .values({
          title: 'Ember & Rust',
          system: 'Daggerheart',
          note: 'De Oude Eed ontwaakt onder Oakvale.',
          rights: DEFAULT_RIGHTS,
          createdBy: demo.id
        })
        .returning();
      await tx.insert(campaignMembers).values([
        { campaignId: campaign.id, userId: demo.id, role: 'gm' },
        { campaignId: campaign.id, userId: lena.id, role: 'player' }
      ]);
      await tx.insert(nodeTypes).values(
        BUILTIN_NODE_TYPES.map((type) => ({
          campaignId: campaign.id,
          key: type.key,
          pluralName: type.nl,
          singularName: type.one,
          colorDark: type.colorDark,
          colorLight: type.colorLight,
          custom: false
        }))
      );

      const sourceNodes = [
        [
          'bram',
          'character',
          'Bram Ironfist',
          'm',
          'Dwarf fighter met een zwak voor slechte weddenschappen.'
        ],
        [
          'nyssa',
          'character',
          'Nyssa Quickfinger',
          'm',
          'Halfling rogue die alleen steelt van wie het verdient.'
        ],
        [
          'theron',
          'character',
          'Theron Ashword',
          'm',
          'Magiër die namen verzamelt zoals anderen munten verzamelen.'
        ],
        [
          'sera',
          'character',
          'Sera Dawnlight',
          'm',
          'Elf cleric van de dageraad. Houdt de groep levend en eerlijk.'
        ],
        [
          'mira',
          'npc',
          'Herbergier Mira',
          'm',
          'Runt The Golden Oak en hoort alles wat in Oakvale gebeurt.'
        ],
        ['aldric', 'npc', 'Koopman Aldric', 'm', 'Verdween met zijn karavaan in het Whisperwood.'],
        [
          'hale',
          'npc',
          'Constable Hale',
          'm',
          'Oakvales enige wetsdienaar. Overwerkt, onderbetaald, eerlijk.'
        ],
        ['vex', 'npc', 'Vex', 'm', 'Heler in Millbrook. Koopt alles en vergeet niemand.'],
        ['elm', 'npc', 'Old Elm', 'm', 'Kluizenaar van het Whisperwood, ouder dan mogelijk lijkt.'],
        [
          'oakvale',
          'location',
          'Oakvale',
          'l',
          'Klein dorp aan de handelsweg, bekend om eiken en roddels.'
        ],
        [
          'inn',
          'building',
          'The Golden Oak',
          'm',
          'Herberg in het hart van Oakvale. Hier begint alles.'
        ],
        ['wood', 'location', 'Whisperwood', 'l', 'Oud bos waar de bomen terug zouden praten.'],
        [
          'caves',
          'location',
          'Grimfang Caves',
          'm',
          'Grottenstelsel aan de bosrand. Goblinterritorium.'
        ],
        [
          'millbrook',
          'location',
          'Millbrook',
          'm',
          'Marktstad een dag rijden naar het oosten. Alles is er te koop.'
        ],
        [
          'shrine',
          'location',
          'Sunken Shrine',
          'm',
          'Verdronken ruïne onder de grotten. Ouder dan het dorp.'
        ],
        [
          'redknives',
          'faction',
          'The Red Knives',
          'l',
          'Smokkelaars die kisten het Whisperwood in brengen.'
        ],
        [
          'grimfang',
          'monster',
          'Grimfang',
          'm',
          'Goblinhoofdman. Slimmer dan zijn soortgenoten en hij weet het.'
        ],
        [
          'wargs',
          'monster',
          'Warg pack',
          's',
          'Jaagt ’s nachts langs de bosrand. Iemand voert ze.'
        ],
        [
          'shade',
          'monster',
          'The Hollow Shade',
          'm',
          'Wat onder het heiligdom slaapt. Het kent Therons naam.'
        ],
        [
          'ring',
          'item',
          'Aldrics zegelring',
          's',
          'Gouden ring met Aldrics handelsmerk, gevonden op het pad.'
        ],
        [
          'ledger',
          'item',
          'Smokkelaarsboek',
          's',
          'Gecodeerd boek van de leveringen van de Red Knives.'
        ],
        [
          'lantern',
          'item',
          'Eeuwige lantaarn',
          's',
          'Brandt zonder olie. Een geschenk van Old Elm.'
        ],
        [
          'idol',
          'item',
          'Verdronken idool',
          's',
          'Zwart stenen beeld uit het heiligdom, koud in elke hand.'
        ],
        [
          'caravan',
          'quest',
          'De verdwenen karavaan',
          'm',
          'Vind Aldric en zijn karavaan. Opgelost, maar niet afgesloten.'
        ],
        [
          'knives',
          'quest',
          'Snijd de aanvoerlijn af',
          'l',
          'Volg de kisten en sluit de route van de Red Knives.'
        ],
        [
          'below',
          'quest',
          'Wat beneden slaapt',
          'l',
          'Iets onder het heiligdom ontwaakt. Ontdek wat, voor het wakker is.'
        ],
        [
          'pact',
          'lore',
          'De Oude Eed',
          's',
          'Oakvales stichters sloten een overeenkomst met het woud.'
        ],
        ['vault', 'location', 'Vault of Embers', 'm', 'Verzegelde schatkamer onder het heiligdom.'],
        [
          'paymaster',
          'npc',
          'De betaalmeester',
          'm',
          'Betaalt voor de offers. Niemand heeft zijn gezicht gezien.'
        ]
      ] as const;

      const inserted = await tx
        .insert(nodes)
        .values(
          sourceNodes.map(([key, typeKey, title, size, summary], index) => {
            const angle = index * 2.399963;
            const distance = 75 + Math.sqrt(index) * 58;
            return {
              campaignId: campaign.id,
              typeKey,
              title,
              size,
              summary,
              revealed: !['vault', 'paymaster'].includes(key),
              visibility: 'all' as const,
              x: Math.cos(angle) * distance,
              y: Math.sin(angle) * distance,
              createdBy: demo.id,
              updatedBy: demo.id
            };
          })
        )
        .returning({ id: nodes.id, title: nodes.title });
      const idFor = new Map(
        sourceNodes.map(([key, , title]) => [
          key,
          inserted.find((node) => node.title === title)!.id
        ])
      );

      await tx.insert(nodeDescriptions).values(
        inserted.map((node) => ({
          nodeId: node.id,
          userId: demo.id,
          body: [P(sourceNodes.find((item) => item[2] === node.title)![4])],
          plainText: sourceNodes.find((item) => item[2] === node.title)![4],
          shared: true
        }))
      );
      await tx.insert(nodeDescriptions).values({
        nodeId: idFor.get('mira')!,
        userId: lena.id,
        body: [P('Ze weet meer over ', R(idFor.get('redknives')!), ' dan ze laat merken.')],
        plainText: 'Ze weet meer over The Red Knives dan ze laat merken.',
        shared: true
      });

      const sourceLinks = [
        ['inn', 'oakvale'],
        ['caves', 'wood'],
        ['shrine', 'caves'],
        ['wood', 'oakvale'],
        ['millbrook', 'oakvale'],
        ['mira', 'inn'],
        ['hale', 'oakvale'],
        ['vex', 'millbrook'],
        ['elm', 'wood'],
        ['aldric', 'oakvale'],
        ['aldric', 'ring'],
        ['bram', 'nyssa'],
        ['theron', 'sera'],
        ['bram', 'inn'],
        ['theron', 'ledger'],
        ['sera', 'lantern'],
        ['grimfang', 'caves'],
        ['wargs', 'wood'],
        ['shade', 'shrine'],
        ['redknives', 'millbrook'],
        ['redknives', 'grimfang'],
        ['vex', 'redknives'],
        ['caravan', 'aldric'],
        ['knives', 'redknives'],
        ['below', 'shrine'],
        ['idol', 'shrine'],
        ['pact', 'wood'],
        ['elm', 'pact'],
        ['mira', 'aldric'],
        ['vault', 'shrine'],
        ['paymaster', 'redknives'],
        ['paymaster', 'vex']
      ];
      await tx.insert(links).values(
        sourceLinks.map(([a, b]) => {
          const pair = [idFor.get(a)!, idFor.get(b)!].sort();
          return {
            campaignId: campaign.id,
            sourceId: pair[0],
            targetId: pair[1],
            createdBy: demo.id
          };
        })
      );

      const sessionBodies: { title: string; date: string; body: Paragraph[] }[] = [
        {
          title: 'Een lege stoel',
          date: '3 Hoogzomer',
          body: [
            P(
              'Het begint met een lege stoel in ',
              R(idFor.get('inn')!),
              '. ',
              R(idFor.get('aldric')!),
              ' had gisteren de wintervoorraad moeten afrekenen, maar zijn karavaan kwam niet aan.'
            ),
            P(
              R(idFor.get('bram')!),
              ' en ',
              R(idFor.get('nyssa')!),
              ' volgen de handelsweg tot waar die in ',
              R(idFor.get('wood')!),
              ' verdwijnt. In de modder ligt ',
              R(idFor.get('ring')!),
              '.'
            ),
            P(
              'De wagensporen buigen af naar ',
              R(idFor.get('caves')!),
              '. Morgen gaan ze naar binnen.'
            )
          ]
        },
        {
          title: 'Grimfang binnen',
          date: '10 Hoogzomer',
          body: [
            P(
              'De ',
              R(idFor.get('caves')!),
              ' ruiken naar natte hond. Een ',
              R(idFor.get('wargs')!),
              ' bewaakt de ingang.'
            ),
            P(
              R(idFor.get('grimfang')!),
              ' vecht niet. Hij onderhandelt. De karavaan is heel en ',
              R(idFor.get('aldric')!),
              ' loopt woedend naar buiten.'
            ),
            P(
              'Mannen met rode messen betaalden vooruit. ',
              R(idFor.get('theron')!),
              ' vindt hun ',
              R(idFor.get('ledger')!),
              '.'
            )
          ]
        },
        {
          title: 'De heler van Millbrook',
          date: '17 Hoogzomer',
          body: [
            P(
              'Het ',
              R(idFor.get('ledger')!),
              ' wijst naar ',
              R(idFor.get('vex')!),
              ' in ',
              R(idFor.get('millbrook')!),
              '.'
            ),
            P(
              'Vex geeft één waarheid: ',
              R(idFor.get('redknives')!),
              ' smokkelen niets naar buiten. Hun kisten gaan het ',
              R(idFor.get('wood')!),
              ' in.'
            ),
            P('Een gevangene fluistert wat erin zit: “Offers.”')
          ]
        },
        {
          title: 'De Oude Eed',
          date: '24 Hoogzomer',
          body: [
            P(
              R(idFor.get('elm')!),
              ' vindt hen vóór zijn hut en vertelt over ',
              R(idFor.get('pact')!),
              ': de stichters van ',
              R(idFor.get('oakvale')!),
              ' kochten hun oogsten met jaarlijkse gaven.'
            ),
            P(
              'In een kist ligt geketend ',
              R(idFor.get('idol')!),
              '. Elm drukt ',
              R(idFor.get('lantern')!),
              ' in Seras handen en wijst naar ',
              R(idFor.get('shrine')!),
              '.'
            )
          ]
        },
        {
          title: 'Wat beneden slaapt',
          date: '31 Hoogzomer',
          body: [
            P(
              'Het ',
              R(idFor.get('shrine')!),
              ' is een kathedraal verdronken in zwart water. ',
              R(idFor.get('lantern')!),
              ' brandt wit.'
            ),
            P(
              'Achter een deur ademt ',
              R(idFor.get('shade')!),
              ' zonder longen. Het vraagt in de stem van Therons vader waarom de gaven nergens meer naar smaken.'
            ),
            P(
              R(idFor.get('sera')!),
              ' houdt de deur terwijl ',
              R(idFor.get('nyssa')!),
              ' het ',
              R(idFor.get('idol')!),
              ' losmaakt. Het beeld is geen offer, maar het slot.'
            ),
            P(
              'Bij dageraad weet iets onder ',
              R(idFor.get('oakvale')!),
              ' Therons ware naam. ',
              R(idFor.get('below')!),
              ' is geen vraag meer van wat, alleen van wanneer.'
            )
          ]
        }
      ];
      const insertedSessions = await tx
        .insert(sessions)
        .values(
          sessionBodies.map((session, index) => ({
            campaignId: campaign.id,
            title: session.title,
            sequence: index + 1,
            worldDate: session.date,
            body: session.body,
            plainText: session.body
              .flatMap((paragraph) => paragraph.segs)
              .map((segment) => (segment.t === 'txt' ? segment.v : ''))
              .join(' '),
            createdBy: demo.id,
            updatedBy: demo.id
          }))
        )
        .returning();
      await tx.insert(sessionScratch).values({
        sessionId: insertedSessions[4].id,
        userId: demo.id,
        body: [
          P(
            'Volgende keer openen met ',
            R(idFor.get('shade')!),
            ' aan de andere kant van de deur.'
          ),
          P(
            'Uitzoeken wat ',
            R(idFor.get('elm')!),
            ' precies wist over ',
            R(idFor.get('pact')!),
            '.'
          )
        ]
      });
      await tx.insert(posts).values([
        {
          nodeId: idFor.get('grimfang')!,
          userId: demo.id,
          kind: 'note',
          visibility: 'gm',
          text: 'Grimfang bewaart de vooruitbetaling onder een valse vloer. Hij is doodsbang voor de bestemming van de kisten.'
        },
        {
          nodeId: idFor.get('mira')!,
          userId: demo.id,
          kind: 'note',
          visibility: 'all',
          text: 'Schenkt de eerste ronde gratis wanneer de groep nieuws brengt.'
        },
        {
          nodeId: idFor.get('aldric')!,
          userId: lena.id,
          kind: 'goal',
          visibility: 'me',
          text: 'Hij is me nog vijftig goud schuldig.'
        }
      ]);
    });
  }

  const [winter] = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(and(eq(campaigns.createdBy, lena.id), eq(campaigns.title, 'The Long Winter')))
    .limit(1);
  if (!winter) {
    const [campaign] = await db
      .insert(campaigns)
      .values({
        title: 'The Long Winter',
        system: 'D&D 5e',
        note: 'Lenna is spelleider · 2 sessies',
        rights: DEFAULT_RIGHTS,
        createdBy: lena.id
      })
      .returning();
    await db.insert(campaignMembers).values([
      { campaignId: campaign.id, userId: lena.id, role: 'gm' },
      { campaignId: campaign.id, userId: demo.id, role: 'player' }
    ]);
    await addTypes(campaign.id);
  }

  console.info(`Seed klaar. Log in met demo@atlore.app / ${DEMO_PASSWORD}`);
} finally {
  await pool.end();
}
