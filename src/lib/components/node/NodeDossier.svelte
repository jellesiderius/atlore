<script lang="ts">
  import { onDestroy } from 'svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import type { MenuItem } from '$lib/components/ui/ContextMenu.svelte';
  import { IMAGE_ACCEPT, imageDropzone } from '$lib/actions/imageDrop';
  import { tooltip } from '$lib/actions/tooltip';
  import RichTextEditor from '$lib/components/richtext/RichTextEditor.svelte';
  import RichTextView from '$lib/components/richtext/RichTextView.svelte';
  import { debounce } from '$lib/client/api';
  import { PLACE_TYPES } from '$lib/domain/constants';
  import { normalizeBody, referencedNodeIds } from '$lib/domain/text';
  import { searchNodes } from '$lib/domain/search';
  import type {
    CampaignMember,
    NodeDossierTab,
    MediaAsset,
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
    media,
    currentUserId,
    liveBody,
    liveUser,
    liveCursors = [],
    tab = 'overview',
    onTab = () => undefined,
    canEdit,
    canWrite,
    canImage,
    canReveal,
    canLink,
    canHistory,
    close,
    openNode,
    previewNode,
    openSession,
    saveNode,
    saveDescription,
    saveNote,
    onLiveBody,
    onLiveCursor,
    connect,
    disconnect,
    upload,
    showHistory,
    createMention,
    showContext,
    showNodeContext
  }: {
    node: WorldNode;
    nodes: WorldNode[];
    links: WorldLink[];
    sessions: SessionEntry[];
    types: NodeType[];
    members: CampaignMember[];
    media: MediaAsset[];
    currentUserId: string;
    liveBody?: Paragraph[];
    liveUser?: string;
    liveCursors?: {
      userId: string;
      userName: string;
      userColor: string;
      offset: number;
    }[];
    tab?: NodeDossierTab;
    onTab?: (tab: NodeDossierTab) => void;
    canEdit: boolean;
    canWrite: boolean;
    canImage: boolean;
    canReveal: boolean;
    canLink: boolean;
    canHistory: boolean;
    close: () => void;
    openNode: (id: string) => void;
    previewNode: (id: string | null, x?: number, y?: number, delay?: number) => void;
    openSession: (id: string) => void;
    saveNode: (value: Record<string, unknown>) => Promise<void>;
    saveDescription: (body: Paragraph[]) => Promise<void>;
    saveNote: (body: Paragraph[]) => Promise<void>;
    onLiveBody?: (nodeId: string, body: Paragraph[]) => void;
    onLiveCursor?: (nodeId: string, offset: number | null) => void;
    connect: (id: string) => Promise<void>;
    disconnect: (id: string) => Promise<void>;
    upload: (file: File, purpose: 'image' | 'map') => Promise<MediaAsset>;
    showHistory: () => void;
    createMention: (title: string, insert: (id: string) => void) => void;
    showContext: (x: number, y: number, items: MenuItem[]) => void;
    showNodeContext: (id: string, x: number, y: number, items?: MenuItem[]) => void;
  } = $props();
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
  let relationQuery = $state('');
  let busy = $state(false);
  let saved = $state('');
  let uploadError = $state('');
  let currentUser = $derived(members.find((member) => member.id === currentUserId));
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
  let image = $derived(media.find((item) => item.id === node.imageMediaId));
  let mapImage = $derived(media.find((item) => item.id === node.mapMediaId));
  let typeMap = $derived(new Map(types.map((item) => [item.key, item])));
  // svelte-ignore state_referenced_locally -- the keyed dossier owns its edit buffer
  let descriptionBody = $state<Paragraph[]>(node.description);
  // svelte-ignore state_referenced_locally -- the keyed dossier owns its private note buffer
  let noteBody = $state<Paragraph[]>(node.note);
  let dirtyDescription = $state(false);
  let dirtyNote = $state(false);
  $effect(() => {
    if (dirtyDescription) return;
    const incoming = liveBody ?? node.description;
    if (JSON.stringify(incoming) !== JSON.stringify(descriptionBody))
      descriptionBody = normalizeBody(incoming);
  });
  $effect(() => {
    if (dirtyNote) return;
    if (JSON.stringify(node.note) !== JSON.stringify(noteBody)) noteBody = normalizeBody(node.note);
  });
  const saveBody = debounce(async (body: Paragraph[]) => {
    try {
      await saveDescription(body);
      saved = t('node.saved');
      setTimeout(() => (saved = ''), 1800);
    } finally {
      dirtyDescription = false;
    }
  }, 350);
  const saveNoteBody = debounce(async (body: Paragraph[]) => {
    try {
      await saveNote(body);
      saved = t('node.saved');
      setTimeout(() => (saved = ''), 1800);
    } finally {
      dirtyNote = false;
    }
  }, 400);
  function descriptionChanged(body: Paragraph[]) {
    descriptionBody = body;
    dirtyDescription = true;
    onLiveBody?.(node.id, body);
    saveBody(body);
  }
  function noteChanged(body: Paragraph[]) {
    noteBody = body;
    dirtyNote = true;
    saveNoteBody(body);
  }
  onDestroy(() => {
    onLiveCursor?.(node.id, null);
    void saveBody.flush();
    void saveNoteBody.flush();
  });
  async function saveHeader() {
    busy = true;
    try {
      await saveNode({ title, summary, type, revealed, visibility, visibleWith });
      saved = t('node.saved');
    } finally {
      busy = false;
    }
  }
  async function uploadImage(file: File, purpose: 'image' | 'map') {
    busy = true;
    uploadError = '';
    try {
      const asset = await upload(file, purpose);
      await saveNode(purpose === 'image' ? { imageMediaId: asset.id } : { mapMediaId: asset.id });
    } catch (error) {
      uploadError = error instanceof Error ? error.message : t('errors.uploadFailed');
    } finally {
      busy = false;
    }
  }
  function imagePicked(event: Event, purpose: 'image' | 'map') {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) void uploadImage(file, purpose);
  }
  function toggleWith(id: string) {
    visibleWith = visibleWith.includes(id)
      ? visibleWith.filter((item) => item !== id)
      : [...visibleWith, id];
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
      <small
        class="type-label"
        style:--type-color-dark={typeMap.get(type)?.colorDark}
        style:--type-color-light={typeMap.get(type)?.colorLight}
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
    {#each [['overview', 'node.overview'], ...(PLACE_TYPES.has(node.type) ? [['map', 'node.map']] : []), ['relations', 'node.relations'], ['story', 'node.story']] as item}<button
        class:active={tab === item[0]}
        onclick={() => onTab(item[0] as NodeDossierTab)}>{t(item[1])}</button
      >{/each}
  </nav>
  <div class="content">
    {#if uploadError}<p class="upload-error" role="alert">{uploadError}</p>{/if}
    {#if tab === 'overview'}
      <div
        class="hero"
        data-image-drop-label={t('node.dropImage')}
        use:imageDropzone={{
          enabled: canImage && !busy,
          onFile: (file) => uploadImage(file, 'image'),
          onInvalid: () => (uploadError = t('server.unsupportedImage'))
        }}
      >
        {#if image}<img src={image.url} alt={node.title} />{/if}
        {#if canImage}<label class:upload={!image} class:replace-image={image}
            ><Icon name="upload" /><span>{image ? t('node.replaceImage') : t('node.addImage')}</span
            ><input
              type="file"
              accept={IMAGE_ACCEPT}
              disabled={busy}
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
          <div class="eyebrow">{t('node.globalDescription')}</div>
          <small
            >{liveUser && !dirtyDescription
              ? t('node.liveUpdate', { name: liveUser })
              : saved || t('node.mentionHint')}</small
          >
        </div>
        <span class="shared"><Icon name="users" size={14} />{t('node.sharedAtTable')}</span>
      </div>
      <RichTextEditor
        body={!dirtyDescription && liveBody ? liveBody : descriptionBody}
        {nodes}
        {types}
        readonly={!canEdit}
        placeholder={t('node.descriptionPlaceholder')}
        onChange={descriptionChanged}
        remoteCursors={liveCursors}
        onCursor={(offset) => onLiveCursor?.(node.id, offset)}
        {openNode}
        {previewNode}
        createNode={createMention}
        {showContext}
        {showNodeContext}
      />
      <section class="node-scratch">
        <div class="scratch-head">
          <span style:background={currentUser?.color ?? 'var(--ember)'}></span>
          <div>
            <div class="eyebrow">
              {t('node.privateNotes', {
                name: currentUser?.name ?? ''
              })}
            </div>
            <small>{t('node.privateHint')}</small>
          </div>
        </div>
        <RichTextEditor
          body={noteBody}
          {nodes}
          {types}
          compact
          readonly={!canWrite}
          placeholder={t('node.privatePlaceholder')}
          onChange={noteChanged}
          {openNode}
          {previewNode}
          createNode={createMention}
          {showContext}
          {showNodeContext}
        />
      </section>
    {:else if tab === 'map'}
      {#if mapImage}<div
          class="node-map"
          data-image-drop-label={t('node.dropMap')}
          use:imageDropzone={{
            enabled: canImage && !busy,
            onFile: (file) => uploadImage(file, 'map'),
            onInvalid: () => (uploadError = t('server.unsupportedImage'))
          }}
        >
          <img src={mapImage.url} alt={t('atlas.mapOf', { title: node.title })} />
          {#if canImage}<label class="replace-map"
              ><Icon name="upload" size={14} /><span>{t('node.replaceMap')}</span><input
                type="file"
                accept={IMAGE_ACCEPT}
                disabled={busy}
                onchange={(event) => imagePicked(event, 'map')}
              /></label
            >{/if}
          <p>{t('node.mapAvailable')}</p>
        </div>{:else if canImage}<label
          class="map-upload"
          data-image-drop-label={t('node.dropMap')}
          use:imageDropzone={{
            enabled: !busy,
            onFile: (file) => uploadImage(file, 'map'),
            onInvalid: () => (uploadError = t('server.unsupportedImage'))
          }}
          ><Icon name="atlas" size={35} /><b class="serif-title"
            >{t('node.mapFor', { title: node.title })}</b
          ><span>{t('node.mapUploadHint')}</span><input
            type="file"
            accept={IMAGE_ACCEPT}
            disabled={busy}
            onchange={(event) => imagePicked(event, 'map')}
          /></label
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
              surface="plain"
              {previewNode}
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
  .type-label {
    color: var(--type-color-dark, var(--text-3));
  }
  :global(:root[data-theme='light']) .type-label {
    color: var(--type-color-light, var(--text-3));
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
    justify-content: center;
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
    position: relative;
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
  .map-upload input,
  .replace-image input,
  .replace-map input {
    display: none;
  }
  .replace-image {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: flex-end;
    justify-content: flex-end;
    gap: 6px;
    padding: 12px;
    cursor: pointer;
  }
  .replace-image > :global(svg),
  .replace-image > span,
  .replace-map {
    border: 1px solid color-mix(in srgb, white 18%, transparent);
    background: rgba(26, 24, 22, 0.82);
    color: #eae8e6;
    backdrop-filter: blur(8px);
  }
  .replace-image > :global(svg) {
    box-sizing: content-box;
    padding: 7px;
    border-radius: 8px 0 0 8px;
    border-right: 0;
  }
  .replace-image > span {
    margin-left: -6px;
    padding: 7px 9px 7px 3px;
    border-radius: 0 8px 8px 0;
    border-left: 0;
    font-size: 11px;
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
  .node-scratch {
    margin-top: 30px;
    padding-top: 18px;
    border-top: 1px solid var(--line);
  }
  .scratch-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
  }
  .scratch-head > span {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }
  .scratch-head small {
    font-size: 10.5px;
    color: var(--text-3);
  }
  .node-scratch :global(.editor) {
    min-height: 100px;
  }
  .map-upload {
    position: relative;
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
  .node-map {
    position: relative;
  }
  .replace-map {
    position: absolute;
    top: 12px;
    right: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 32px;
    padding: 0 10px;
    border-radius: 8px;
    font-size: 11px;
    cursor: pointer;
  }
  .node-map p {
    color: var(--text-3);
    font-size: 12px;
  }
  :global(.hero[data-image-dragging='true'])::after,
  :global(.node-map[data-image-dragging='true'])::after,
  :global(.map-upload[data-image-dragging='true'])::after {
    content: attr(data-image-drop-label);
    position: absolute;
    z-index: 5;
    inset: 8px;
    display: grid;
    place-items: center;
    border: 2px dashed var(--ember);
    border-radius: 10px;
    background: color-mix(in srgb, var(--canvas) 88%, transparent);
    color: var(--text);
    font: 18px var(--font-serif);
    pointer-events: none;
  }
  .upload-error {
    margin: 0 0 12px;
    padding: 8px 10px;
    border: 1px solid color-mix(in srgb, var(--danger, #d96868) 55%, var(--line));
    border-radius: 8px;
    background: var(--bg-2);
    color: var(--danger, #d96868);
    font-size: 12px;
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
    .description-head {
      align-items: flex-start;
      flex-direction: column;
    }
  }
</style>
