<script lang="ts">
  import Icon from '$lib/components/ui/Icon.svelte';
  import { tooltip } from '$lib/actions/tooltip';
  import RichTextEditor from '$lib/components/richtext/RichTextEditor.svelte';
  import RichTextView from '$lib/components/richtext/RichTextView.svelte';
  import { debounce } from '$lib/client/api';
  import { CHARACTER_FIELDS, PLACE_TYPES } from '$lib/domain/constants';
  import { referencedNodeIds } from '$lib/domain/text';
  import { searchNodes } from '$lib/domain/search';
  import type {
    CampaignMember,
    MediaAsset,
    NodePost,
    NodeType,
    Paragraph,
    SessionEntry,
    Visibility,
    WorldLink,
    WorldNode
  } from '$lib/types';
  import { nodeTypeLabel, t } from '$lib/i18n/index.svelte';
  let {
    node,
    nodes,
    links,
    sessions,
    types,
    members,
    posts,
    media,
    currentUserId,
    canEdit,
    canImage,
    canReveal,
    canLink,
    canHistory,
    close,
    openNode,
    openSession,
    saveNode,
    saveDescription,
    connect,
    disconnect,
    addPost,
    upload,
    showHistory,
    createMention
  }: {
    node: WorldNode;
    nodes: WorldNode[];
    links: WorldLink[];
    sessions: SessionEntry[];
    types: NodeType[];
    members: CampaignMember[];
    posts: NodePost[];
    media: MediaAsset[];
    currentUserId: string;
    canEdit: boolean;
    canImage: boolean;
    canReveal: boolean;
    canLink: boolean;
    canHistory: boolean;
    close: () => void;
    openNode: (id: string) => void;
    openSession: (id: string) => void;
    saveNode: (value: Record<string, unknown>) => Promise<void>;
    saveDescription: (body: Paragraph[], shared: boolean) => Promise<void>;
    connect: (id: string) => Promise<void>;
    disconnect: (id: string) => Promise<void>;
    addPost: (value: {
      nodeId: string;
      kind: 'note' | 'theory' | 'goal';
      visibility: 'all' | 'me' | 'gm' | 'sel';
      visibleWith: string[];
      text: string;
    }) => Promise<void>;
    upload: (file: File, purpose: 'image' | 'map') => Promise<MediaAsset>;
    showHistory: () => void;
    createMention: (title: string, insert: (id: string) => void) => void;
  } = $props();
  let tab = $state<'overview' | 'map' | 'game' | 'relations' | 'story'>('overview');
  // svelte-ignore state_referenced_locally -- the keyed dossier owns its edit buffer
  let title = $state(node.title);
  // svelte-ignore state_referenced_locally -- the keyed dossier owns its edit buffer
  let summary = $state(node.summary);
  // svelte-ignore state_referenced_locally -- the keyed dossier owns its edit buffer
  let type = $state(node.type);
  // svelte-ignore state_referenced_locally -- the keyed dossier owns its edit buffer
  let visibility = $state<Visibility>(node.visibility);
  // svelte-ignore state_referenced_locally -- the keyed dossier owns its edit buffer
  let revealed = $state(node.revealed);
  // svelte-ignore state_referenced_locally -- the keyed dossier owns its edit buffer
  let visibleWith = $state([...node.visibleWith]);
  // svelte-ignore state_referenced_locally -- the keyed dossier owns its edit buffer
  let stats = $state({ ...node.stats });
  // svelte-ignore state_referenced_locally -- the keyed dossier owns its edit buffer
  let gear = $state(node.gear.map((item) => ({ ...item })));
  let relationQuery = $state('');
  let postText = $state('');
  let postKind = $state<'note' | 'theory' | 'goal'>('note');
  let postVisibility = $state<'all' | 'me' | 'gm' | 'sel'>('me');
  let busy = $state(false);
  let saved = $state('');
  let own = $derived(node.descriptions.find((description) => description.userId === currentUserId));
  let others = $derived(
    node.descriptions.filter((description) => description.userId !== currentUserId)
  );
  let related = $derived(
    links
      .filter((link) => link.sourceId === node.id || link.targetId === node.id)
      .map((link) => ({
        link,
        other: nodes.find(
          (item) => item.id === (link.sourceId === node.id ? link.targetId : link.sourceId)
        )
      }))
      .filter((item) => item.other)
  );
  let relatedIds = $derived(new Set([node.id, ...related.map((item) => item.other!.id)]));
  let relationResults = $derived(
    searchNodes(nodes, relationQuery, { limit: 6, exclude: relatedIds })
  );
  let mentions = $derived(
    sessions.filter((session) => referencedNodeIds(session.body).has(node.id))
  );
  let nodePosts = $derived(posts.filter((post) => post.nodeId === node.id));
  let image = $derived(media.find((item) => item.id === node.imageMediaId));
  let mapImage = $derived(media.find((item) => item.id === node.mapMediaId));
  let typeMap = $derived(new Map(types.map((item) => [item.key, item])));
  // svelte-ignore state_referenced_locally -- the keyed dossier owns its edit buffer
  let descriptionBody = $state<Paragraph[]>(own?.body ?? [{ segs: [{ t: 'txt', v: '' }] }]);
  // svelte-ignore state_referenced_locally -- the keyed dossier owns its edit buffer
  let shared = $state(own?.shared ?? true);
  const saveBody = debounce(async (body: Paragraph[]) => {
    descriptionBody = body;
    await saveDescription(body, shared);
    saved = t('node.saved');
    setTimeout(() => (saved = ''), 1800);
  }, 700);
  async function saveHeader() {
    busy = true;
    try {
      await saveNode({ title, summary, type, revealed, visibility, visibleWith });
      saved = t('node.saved');
    } finally {
      busy = false;
    }
  }
  async function imagePicked(event: Event, purpose: 'image' | 'map') {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    busy = true;
    try {
      const asset = await upload(file, purpose);
      await saveNode(purpose === 'image' ? { imageMediaId: asset.id } : { mapMediaId: asset.id });
    } finally {
      busy = false;
    }
  }
  function toggleWith(id: string) {
    visibleWith = visibleWith.includes(id)
      ? visibleWith.filter((item) => item !== id)
      : [...visibleWith, id];
  }
  async function submitPost(event: SubmitEvent) {
    event.preventDefault();
    if (!postText.trim()) return;
    await addPost({
      nodeId: node.id,
      kind: postKind,
      visibility: postVisibility,
      visibleWith: [],
      text: postText
    });
    postText = '';
  }
  async function saveGame() {
    await saveNode({ stats, gear });
    saved = t('node.saved');
  }
</script>

<section class="dossier" aria-busy={busy}>
  <header>
    <button
      class="icon-button"
      aria-label={t('node.dossierClose')}
      use:tooltip={t('node.dossierClose')}
      onclick={close}><Icon name="back" size={17} /></button
    >
    <div>
      <small style:color={typeMap.get(type)?.colorDark}
        >{typeMap.get(type) ? nodeTypeLabel(typeMap.get(type)!, 'singular') : type}</small
      ><input
        aria-label={t('node.name')}
        bind:value={title}
        disabled={!canEdit}
        onblur={saveHeader}
      />
    </div>
    {#if canHistory}<button
        class="icon-button"
        aria-label={t('history.eyebrow')}
        use:tooltip={t('history.eyebrow')}
        onclick={showHistory}><Icon name="clock" size={16} /></button
      >{/if}
  </header>
  <nav>
    {#each [['overview', 'node.overview'], ...(PLACE_TYPES.has(node.type) ? [['map', 'node.map']] : []), ['game', 'node.game'], ['relations', 'node.relations'], ['story', 'node.story']] as item}<button
        class:active={tab === item[0]}
        onclick={() => (tab = item[0] as typeof tab)}>{t(item[1])}</button
      >{/each}
  </nav>
  <div class="content">
    {#if tab === 'overview'}
      <div class="hero">
        {#if image}<img src={image.url} alt={node.title} />{:else if canImage}<label class="upload"
            ><Icon name="upload" /><span>{t('node.addImage')}</span><input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onchange={(event) => imagePicked(event, 'image')}
            /></label
          >{/if}
      </div>
      <div class="header-fields">
        <select class="field" bind:value={type} disabled={!canEdit} onchange={saveHeader}
          >{#each types.filter((item) => item.key !== 'session') as item}<option value={item.key}
              >{nodeTypeLabel(item, 'singular')}</option
            >{/each}</select
        >
        <div class="visibility">
          <button
            disabled={!canReveal}
            class:active={revealed && visibility === 'all'}
            onclick={() => {
              revealed = true;
              visibility = 'all';
              saveHeader();
            }}>{t('node.everyone')}</button
          ><button
            disabled={!canReveal}
            class:active={revealed && visibility === 'sel'}
            onclick={() => {
              revealed = true;
              visibility = 'sel';
            }}>{t('node.selected')}</button
          ><button
            disabled={!canReveal}
            class:active={!revealed || visibility === 'me'}
            onclick={() => {
              revealed = false;
              visibility = 'me';
              saveHeader();
            }}>{t('node.onlyMe')}</button
          >
        </div>
      </div>
      {#if visibility === 'sel'}<div class="player-picks">
          {#each members.filter((member) => member.role === 'player') as member}<button
              disabled={!canReveal}
              class:active={visibleWith.includes(member.id)}
              onclick={() => {
                toggleWith(member.id);
                saveHeader();
              }}><span style:background={member.color}></span>{member.name}</button
            >{/each}
        </div>{/if}
      <label class="summary-label"
        >{t('node.summary')}<input
          class="field"
          bind:value={summary}
          disabled={!canEdit}
          placeholder={t('node.summaryPlaceholder')}
          onblur={saveHeader}
        /></label
      >
      <div class="description-head">
        <div>
          <div class="eyebrow">{t('node.yourDescription')}</div>
          <small>{saved || t('node.mentionHint')}</small>
        </div>
        <button
          class:shared
          disabled={!canEdit}
          onclick={async () => {
            shared = !shared;
            await saveDescription(descriptionBody, shared);
          }}
          ><Icon name={shared ? 'eye' : 'eye-off'} size={14} />{shared
            ? t('node.sharedAtTable')
            : t('node.privateForYou')}</button
        >
      </div>
      <RichTextEditor
        body={descriptionBody}
        {nodes}
        {types}
        readonly={!canEdit}
        placeholder={t('node.descriptionPlaceholder')}
        onChange={saveBody}
        {openNode}
        createNode={createMention}
      />
      {#if others.length}<details>
          <summary>{t('node.showOthers', { count: others.length })}</summary
          >{#each others as description}<article style:border-left-color={description.userColor}>
              <b style:color={description.userColor}>{description.userName}</b><RichTextView
                body={description.body}
                {nodes}
                {types}
                {openNode}
              />
            </article>{/each}
        </details>{/if}
      <div class="posts">
        <div class="eyebrow">{t('node.notes')}</div>
        {#each nodePosts as post}<article style:border-left-color={post.byColor}>
            <header>
              <b style:color={post.byColor}>{post.byName}</b><span
                >{t(`node.postKind.${post.kind}`)} · {t(
                  `node.postVisibility.${post.visibility}`
                )}</span
              >
            </header>
            <p>{post.text}</p>
          </article>{/each}
        {#if canEdit}<form onsubmit={submitPost}>
            <div>
              <select bind:value={postKind}
                ><option value="note">{t('node.postKind.note')}</option><option value="theory"
                  >{t('node.postKind.theory')}</option
                ><option value="goal">{t('node.postKind.goal')}</option></select
              ><select bind:value={postVisibility}
                ><option value="me">{t('node.postVisibility.me')}</option><option value="all"
                  >{t('node.postVisibility.all')}</option
                ><option value="gm">{t('node.postVisibility.gm')}</option></select
              >
            </div>
            <textarea class="field" bind:value={postText} rows="2" placeholder={t('node.newNote')}
            ></textarea><button class="secondary-button">{t('node.addNote')}</button>
          </form>{/if}
      </div>
    {:else if tab === 'map'}
      {#if mapImage}<div class="node-map">
          <img src={mapImage.url} alt={t('atlas.mapOf', { title: node.title })} />
          <p>{t('node.mapAvailable')}</p>
        </div>{:else if canImage}<label class="map-upload"
          ><Icon name="atlas" size={35} /><b class="serif-title"
            >{t('node.mapFor', { title: node.title })}</b
          ><span>{t('node.mapUploadHint')}</span><input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onchange={(event) => imagePicked(event, 'map')}
          /></label
        >{/if}
    {:else if tab === 'game'}
      <div class="eyebrow">{t('node.statistics')}</div>
      <div class="stats">
        {#each CHARACTER_FIELDS[node.type] ?? ['ac', 'hp', 'speed', 'initiative'] as key}<label
            >{key.toUpperCase()}<input
              class="field"
              value={stats[key] ?? ''}
              disabled={!canEdit}
              oninput={(event) => (stats[key] = event.currentTarget.value)}
            /></label
          >{/each}
      </div>
      <div class="gear-head">
        <div class="eyebrow">{t('node.gear')}</div>
        {#if canEdit}<button onclick={() => (gear = [...gear, { name: '', note: '' }])}
            >+ {t('node.addRow')}</button
          >{/if}
      </div>
      <div class="gear">
        {#each gear as item, index}<input
            class="field"
            bind:value={item.name}
            placeholder={t('node.item')}
            disabled={!canEdit}
          /><input
            class="field"
            bind:value={item.note}
            placeholder={t('node.note')}
            disabled={!canEdit}
          /><button onclick={() => (gear = gear.filter((_, i) => i !== index))}>×</button>{/each}
      </div>
      {#if canEdit}<button class="primary-button save-game" onclick={saveGame}
          >{t('node.saveGame')}</button
        >{/if}
    {:else if tab === 'relations'}
      <div class="eyebrow">{t('node.linked', { count: related.length })}</div>
      <div class="relations">
        {#each related as item}<button class="relation" onclick={() => openNode(item.other!.id)}
            ><span style:background={typeMap.get(item.other!.type)?.colorDark}></span><b
              >{item.other!.title}</b
            ><small
              >{typeMap.get(item.other!.type)
                ? nodeTypeLabel(typeMap.get(item.other!.type)!, 'singular')
                : ''}</small
            ></button
          >{#if canLink}<button
              class="unlink"
              aria-label={t('node.unlink')}
              onclick={() => disconnect(item.link.id)}>×</button
            >{/if}{/each}
      </div>
      {#if canLink}<div class="relation-search">
          <input
            class="field"
            bind:value={relationQuery}
            placeholder={t('node.connectSearch')}
          />{#if relationQuery}<div>
              {#each relationResults as result}<button
                  onclick={() => {
                    connect(result.id);
                    relationQuery = '';
                  }}
                  ><span style:background={typeMap.get(result.type)?.colorDark}
                  ></span>{result.title}<em>+</em></button
                >{/each}
            </div>{/if}
        </div>{/if}
      <div class="eyebrow suggestions-title">{t('node.mentionedTogether')}</div>
      <div class="session-chips">
        {#each mentions as session}<button onclick={() => openSession(session.id)}
            >{session.title}</button
          >{/each}{#if !mentions.length}<p>{t('node.notMentioned')}</p>{/if}
      </div>
    {:else}
      <div class="eyebrow">{t('node.inStory', { count: mentions.length })}</div>
      <div class="story-list">
        {#each mentions as session}<button onclick={() => openSession(session.id)}
            ><small
              >{t('session.sequence', { number: session.sequence })} · {session.worldDate}</small
            ><b class="serif-title">{session.title}</b><RichTextView
              body={session.body
                .filter((paragraph) =>
                  paragraph.segs.some((segment) => segment.t === 'ref' && segment.id === node.id)
                )
                .slice(0, 2)}
              {nodes}
              {types}
              {openNode}
            /></button
          >{/each}{#if !mentions.length}<p>{t('node.notInStory')}</p>{/if}
      </div>
    {/if}
  </div>
</section>

<style>
  .dossier {
    position: absolute;
    inset: 0;
    z-index: 25;
    display: flex;
    flex-direction: column;
    background: var(--canvas);
    animation: fade-in 0.18s ease;
  }
  .dossier > header {
    height: 57px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 10px;
    border-bottom: 1px solid var(--line);
  }
  .dossier > header > div {
    min-width: 0;
    flex: 1;
  }
  .dossier > header small {
    display: block;
    font: 9px var(--font-mono);
    letter-spacing: 0.11em;
    text-transform: uppercase;
  }
  .dossier > header input {
    width: 100%;
    border: 0;
    outline: 0;
    background: transparent;
    font: 22px var(--font-serif);
  }
  .dossier > nav {
    height: 42px;
    display: flex;
    gap: 2px;
    padding: 5px 13px;
    border-bottom: 1px solid var(--line);
    overflow-x: auto;
  }
  .dossier > nav button {
    min-width: max-content;
    padding: 0 10px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: var(--text-3);
    font-size: 12px;
  }
  .dossier > nav button.active {
    background: var(--bg-3);
    color: var(--text);
  }
  .content {
    flex: 1;
    overflow-y: auto;
    padding: 22px max(20px, calc((100% - 760px) / 2)) 90px;
  }
  .hero {
    height: 180px;
    margin-bottom: 16px;
    border: 1px solid var(--line);
    border-radius: 13px;
    overflow: hidden;
    background: var(--bg-2);
  }
  .hero img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .upload {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 7px;
    color: var(--text-3);
    cursor: pointer;
  }
  .upload input,
  .map-upload input {
    display: none;
  }
  .header-fields {
    display: grid;
    grid-template-columns: 160px 1fr;
    gap: 8px;
  }
  .visibility {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
  }
  .visibility button,
  .player-picks button {
    border: 1px solid var(--line);
    border-radius: 8px;
    background: transparent;
    color: var(--text-3);
    font-size: 11px;
  }
  .visibility button.active,
  .player-picks button.active {
    border-color: var(--ember);
    color: var(--ember);
    background: var(--ember-soft);
  }
  .player-picks {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 7px;
  }
  .player-picks button {
    min-height: 29px;
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 0 8px;
  }
  .player-picks span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }
  .summary-label {
    display: block;
    margin: 14px 0 22px;
    font-size: 11px;
    color: var(--text-3);
  }
  .summary-label .field {
    display: block;
    margin-top: 5px;
  }
  .description-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 10px;
  }
  .description-head small {
    font: 9.5px var(--font-mono);
    color: var(--text-3);
  }
  .shared {
    min-height: 30px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 8px;
    border: 1px solid var(--line);
    border-radius: 7px;
    background: transparent;
    color: var(--text-3);
    font-size: 10.5px;
  }
  details {
    margin-top: 24px;
    border-top: 1px solid var(--line);
    padding-top: 12px;
  }
  details summary {
    cursor: pointer;
    color: var(--text-3);
    font-size: 12px;
  }
  details article {
    margin-top: 12px;
    padding-left: 12px;
    border-left: 2px solid;
  }
  details article > b {
    display: block;
    margin-bottom: 6px;
    font-size: 11px;
  }
  .posts {
    margin-top: 26px;
    padding-top: 18px;
    border-top: 1px solid var(--line);
  }
  .posts > article {
    margin: 8px 0;
    padding: 9px 10px;
    border-left: 2px solid;
    background: var(--bg-2);
    border-radius: 0 8px 8px 0;
  }
  .posts article header {
    display: flex;
    justify-content: space-between;
  }
  .posts article b {
    font-size: 11px;
  }
  .posts article span {
    font: 9px var(--font-mono);
    color: var(--text-3);
  }
  .posts article p {
    margin: 5px 0 0;
    color: var(--text-2);
    font-size: 12.5px;
  }
  .posts form > div {
    display: flex;
    gap: 4px;
    margin: 8px 0 4px;
  }
  .posts select {
    min-height: 28px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--bg-3);
    font-size: 11px;
  }
  .posts form .secondary-button {
    margin-top: 5px;
    min-height: 32px;
  }
  .map-upload {
    height: 330px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    border: 1px dashed var(--line-2);
    border-radius: 13px;
    color: var(--text-3);
    cursor: pointer;
  }
  .map-upload b {
    font-size: 24px;
    color: var(--text);
  }
  .node-map img {
    width: 100%;
    max-height: 480px;
    object-fit: contain;
    border: 1px solid var(--line);
    border-radius: 12px;
  }
  .node-map p {
    color: var(--text-3);
    font-size: 12px;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 7px;
    margin: 9px 0 25px;
  }
  .stats label {
    font: 9px var(--font-mono);
    color: var(--text-3);
  }
  .stats .field {
    display: block;
    min-height: 36px;
    margin-top: 4px;
  }
  .gear-head {
    display: flex;
    justify-content: space-between;
  }
  .gear-head button {
    border: 0;
    background: transparent;
    color: var(--ember);
    font-size: 12px;
  }
  .gear {
    display: grid;
    grid-template-columns: 1fr 1.4fr 30px;
    gap: 5px;
    margin-top: 8px;
  }
  .gear button {
    border: 0;
    background: transparent;
    color: var(--text-3);
  }
  .save-game {
    margin-top: 12px;
  }
  .relations {
    display: grid;
    grid-template-columns: 1fr 30px;
    gap: 3px;
    margin-top: 8px;
  }
  .relation {
    min-height: 38px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 9px;
    border: 0;
    border-radius: 8px;
    background: var(--bg-3);
    color: var(--text-2);
    text-align: left;
  }
  .relation > span,
  .relation-search button > span {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }
  .relation b {
    flex: 1;
    font-weight: 500;
  }
  .relation small {
    font: 9px var(--font-mono);
    color: var(--text-3);
  }
  .unlink {
    border: 0;
    background: transparent;
    color: var(--text-3);
  }
  .relation-search {
    position: relative;
    margin-top: 12px;
  }
  .relation-search > div {
    position: absolute;
    z-index: 5;
    left: 0;
    right: 0;
    top: 46px;
    padding: 4px;
    border: 1px solid var(--line);
    border-radius: 9px;
    background: var(--bg-2);
  }
  .relation-search > div button {
    width: 100%;
    min-height: 34px;
    display: flex;
    align-items: center;
    gap: 7px;
    border: 0;
    background: transparent;
    color: var(--text-2);
    text-align: left;
  }
  .relation-search em {
    margin-left: auto;
    color: var(--ember);
  }
  .suggestions-title {
    margin-top: 30px;
  }
  .session-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 9px;
  }
  .session-chips button {
    min-height: 32px;
    padding: 0 9px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--bg-3);
    color: var(--text-2);
    font-size: 11.5px;
  }
  .session-chips p,
  .story-list > p {
    color: var(--text-3);
    font-size: 12px;
  }
  .story-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 10px;
  }
  .story-list > button {
    padding: 14px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--bg-2);
    color: var(--text);
    text-align: left;
  }
  .story-list small {
    display: block;
    font: 9px var(--font-mono);
    text-transform: uppercase;
    color: var(--text-3);
  }
  .story-list b {
    display: block;
    margin: 4px 0 8px;
    font-size: 22px;
    font-weight: 400;
  }
  @media (max-width: 640px) {
    .content {
      padding: 14px 14px 90px;
    }
    .hero {
      height: 150px;
    }
    .header-fields {
      grid-template-columns: 1fr;
    }
    .stats {
      grid-template-columns: repeat(2, 1fr);
    }
    .gear {
      grid-template-columns: 1fr 30px;
    }
    .gear input:nth-child(3n + 2) {
      grid-column: 1;
    }
    .gear button {
      grid-column: 2;
      grid-row: auto;
    }
    .description-head {
      align-items: flex-start;
      flex-direction: column;
    }
  }
</style>
