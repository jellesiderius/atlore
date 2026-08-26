# Atlore

Atlore is een gezamenlijke kennisgraaf voor tabletop-campagnes. Spelleiders en spelers bouwen een wereld op uit nodes, leggen relaties, schrijven sessieverslagen met `@`-verwijzingen en plaatsen locaties op kaarten. De applicatie is uitgewerkt vanuit het aangeleverde Claude-prototype en volgt diens donkere en lichte visuele taal.

## Snel starten

Benodigd: Docker Desktop (of Docker Engine met Compose), GNU Make en optioneel Node.js 22+ voor lokale ontwikkeling.

```bash
cp .env.example .env
make up
make seed
```

Open daarna [http://localhost:3000](http://localhost:3000). De demodata bevat twee accounts:

- `demo@atlore.app` / `AtloreDemo!2026` (spelleider)
- `lena@atlore.app` / `AtloreDemo!2026` (speler)

Wijzig alle voorbeeldwachtwoorden en secrets voordat de stack publiek bereikbaar wordt.

## Dagelijkse commando's

```bash
make help       # alle beschikbare commando's
make up         # productie-stack bouwen en starten
make down       # containers uitzetten, data behouden
make stop       # containers stoppen
make restart    # containers herstarten
make logs       # app-logs volgen
make status     # health en containerstatus
make seed       # idempotente demodata plaatsen
make seed-10k   # 10.000-node performancewereld voor LOAD_TEST_EMAIL
make check      # typecheck, lint en unit-tests
make e2e        # Playwright desktop + mobiel
make test-10k   # echte Chromium-loadtest met framebudget
make clean      # alleen gegenereerde bestanden wissen
make destroy    # containers en volumes wissen, met bevestiging
```

Voor een snelle lokale ontwikkelcyclus:

```bash
npm install
make infra
make migrate
npm run dev
```

De Vite-server draait dan standaard op [http://localhost:5173](http://localhost:5173). De Docker-productie-app gebruikt poort `3000`.

## Architectuur

De code is componentgericht opgebouwd. Routecomponenten orkestreren state en API-calls; domeinlogica, serverdiensten en visuele componenten blijven afzonderlijk.

```text
src/
├── lib/components/
│   ├── auth/          authenticatieschermen
│   ├── campaign/      campagnekaarten en beheer
│   ├── graph/         canvas, worker en graph-bediening
│   ├── map/           kaarten en markers
│   ├── node/          dossier, relaties en node-aanmaak
│   ├── richtext/      gedeelde editor, viewer en nodechips
│   ├── session/       sessie-editor en verhaalweergave
│   ├── ui/            modals, iconen, menu's en meldingen
│   └── workspace/     navigatie, zoeken, historie en beheer
├── lib/domain/        pure, geteste zoek-, ACL-, tekst- en diff-logica
├── lib/i18n/          snippetcatalogi, locale-state en serververtalingen
├── lib/server/        auth, configuratie, database, mail, storage en services
├── routes/api/        gevalideerde SvelteKit JSON-endpoints
└── workers/           force-layout buiten de hoofdthread
```

De stack bestaat uit:

- SvelteKit 2 + Svelte 5, TypeScript, Vite en Tailwind CSS 4;
- YML-snippets voor Nederlandse en Engelse interface-, API- en e-mailteksten;
- PostgreSQL 17 met Drizzle ORM en versioneerbare SQL-migraties;
- Redis voor rate limiting en realtime invalidaties;
- WebSockets voor updates tussen gelijktijdige campagnegebruikers;
- S3-compatible object storage, lokaal geleverd door MinIO;
- Argon2-wachtwoordhashing en gehashte sessie-/hersteltokens;
- een service worker en webmanifest voor PWA-installatie;
- Vitest en Playwright voor unit-, API-, desktop- en mobiele tests.

Composer is bewust niet opgenomen: Atlore bevat geen PHP-runtime of PHP-packages. `npm` beheert de JavaScript-toolchain; database- en infrastructuurdependencies draaien als gepinde containers. Een lege Composer-config zou geen productiefunctie toevoegen.

## Functionaliteit

- accounts, inloggen, uitloggen en wachtwoordherstel;
- meerdere campagnes, uitnodigingen, ledenrollen en 14 instelbare spelersrechten;
- twaalf ingebouwde en zelf toe te voegen nodetypes;
- interactieve force-graph met zoeken, filteren, slepen, herschikken en contextmenu's;
- Obsidian-achtige verbonden swarm-drag met focus-backdrop en worker-layout;
- node-dossiers met gedeelde/persoonlijke beschrijvingen, speldata, uitrusting, afbeeldingen, kaarten, relaties, verhaal en notities;
- rijke sessietekst met `@`-autocomplete, stille matches en automatisch afgeleide relaties;
- sessieweergave, doorlopend verhaal, persoonlijk sessieklad en versieherstel;
- atlas met upload, pan/zoom, drag-and-dropmarkers en vergrendeling;
- prullenbak voor nodes en sessies, inclusief herstel en definitief verwijderen;
- GM-weergave als speler, server-side gefilterd en in de UI alleen-lezen;
- realtime refresh, dark/light mode, responsive mobiele navigatie en PWA-cache.

## Vertalingen en snippets

Alle interface-, fout- en e-mailteksten staan per taal in `src/lib/i18n/locales/nl.yaml` en `src/lib/i18n/locales/en.yaml`. Nederlands is de standaardtaal. De taalkeuze wordt in `localStorage` én de cookie `atlore_locale` bewaard, zodat zowel Svelte-componenten als serverresponses en e-mails dezelfde taal gebruiken.

Voeg een tekst in beide YML-bestanden onder dezelfde semantische sleutel toe:

```yml
campaign:
  welcome: Welkom in {{title}}
```

Gebruik de snippet vervolgens in een component:

```svelte
<script lang="ts">
  import { t } from '$lib/i18n/index.svelte';
</script>

<h1>{t('campaign.welcome', { title: campaign.title })}</h1>
```

Servercode gebruikt `serverT()` uit `src/lib/i18n/server.ts`. De unit-tests controleren automatisch dat beide catalogi dezelfde sleutels en interpolatievelden bevatten en dat alle statisch gebruikte `t('…')`-sleutels bestaan.

## Configuratie

Alle configuratie loopt via `.env`; de server valideert de waarden bij het starten. Zie [`.env.example`](./.env.example) voor de volledige lijst.

Belangrijk voor productie:

- zet `NODE_ENV=production`;
- zet `ORIGIN` exact op de publieke HTTPS-origin;
- zet eventuele extra toegestane preview- of proxydomeinen komma-gescheiden in `TRUSTED_ORIGINS`;
- genereer sterke, unieke waarden voor `POSTGRES_PASSWORD`, `REALTIME_SECRET`, `S3_ACCESS_KEY` en `S3_SECRET_KEY`;
- configureer SMTP voor echte herstel- en uitnodigingsmails;
- beëindig TLS bij een reverse proxy of load balancer;
- geef proxyheaders alleen door vanaf een vertrouwde proxy;
- maak periodieke backups van PostgreSQL en de object-storagebucket.

Zonder S3-configuratie valt de applicatie terug op `STORAGE_PATH`. Zonder Redis blijft de app functioneel met process-local rate limiting, maar horizontale realtime synchronisatie vereist Redis.

## Database en migraties

De SQL-migraties staan in `drizzle/` en worden bij `make up` uitgevoerd door de eenmalige `migrate`-service.

```bash
npm run db:generate  # nieuwe migratie genereren na schemawijzigingen
npm run db:migrate   # migraties toepassen
npm run db:seed      # demowereld idempotent vullen
npm run db:studio    # Drizzle Studio openen
```

Maak een PostgreSQL-backup bijvoorbeeld met:

```bash
docker compose exec -T postgres pg_dump -U atlore -Fc atlore > atlore.backup
```

## Kwaliteitscontroles

```bash
npm run check        # Svelte + TypeScript
npm run lint         # ESLint voor TS, JS en Svelte
npm test             # pure domein-unit-tests
npm run test:e2e     # API- en browserflows, desktop + mobiel
npm run test:load    # 10k-nodes: loadtijd, beweging, FPS en long tasks
npm run build        # adapter-node productiebuild
```

Installeer eenmalig de Playwright-browser als die lokaal nog ontbreekt:

```bash
npx playwright install chromium
```

De healthcheck is beschikbaar op `/api/health` en rapporteert PostgreSQL- en Redisstatus. Docker controleert dit endpoint automatisch.

Voor de reproduceerbare 10k-test:

```bash
make seed-10k
make test-10k
```

Standaard wordt de campagne aangemaakt voor het meegeleverde demo-account; kies een ander bestaand account met `LOAD_TEST_EMAIL=naam@example.com make seed-10k`. Gebruik dezelfde variabele bij `make test-10k`. De grote graph gebruikt een Web Worker voor de initiële layout, gebatchte Canvas 2D-paths en een lichtere interactieve simulatie zodat de hoofdthread responsief blijft.

## Beveiligingsmodel

Alle mutaties valideren input met Zod en voeren campagne-ACL en nodezichtbaarheid opnieuw op de server uit. Verborgen nodes worden niet in spelerspayloads opgenomen. Sessiecookies zijn `HttpOnly`, `SameSite=Lax` en bij een HTTPS-origin `Secure`; niet-idempotente requests hebben een origin-check. De response bevat CSP-, framing-, MIME-, referrer- en permissions-beveiliging. Realtime tokens zijn kortlevend en HMAC-ondertekend.

## Bijdragen en licentie

Issues en pull requests zijn welkom; lees [CONTRIBUTING.md](./CONTRIBUTING.md) voor de korte ontwikkelflow. Atlore wordt uitgebracht onder de [MIT-licentie](./LICENSE).
