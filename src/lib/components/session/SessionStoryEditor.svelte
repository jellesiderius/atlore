<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { debounce } from '$lib/client/api';
  import type { MenuItem } from '$lib/components/ui/ContextMenu.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import RichTextEditor from '$lib/components/richtext/RichTextEditor.svelte';
  import { normalizeBody } from '$lib/domain/text';
  import { t } from '$lib/i18n/index.svelte';
  import type { NodeType, Paragraph, SessionEntry, SessionScratch, WorldNode } from '$lib/types';

  let {
    session,
    scratch,
    nodes,
    types,
    currentUserName,
    liveBody,
    liveUser,
    liveCursors = [],
    canWrite,
    canHistory,
    canDelete,
    openNode,
    previewNode,
    createMention,
    save,
    saveScratch,
    onLiveBody,
    onLiveCursor,
    close,
    history,
    trash,
    showContext,
    showNodeContext
  }: {
    session: SessionEntry;
    scratch?: SessionScratch;
    nodes: WorldNode[];
    types: NodeType[];
    currentUserName: string;
    liveBody?: Paragraph[];
    liveUser?: string;
    liveCursors?: {
      userId: string;
      userName: string;
      userColor: string;
      offset: number;
    }[];
    canWrite: boolean;
    canHistory: boolean;
    canDelete: boolean;
    openNode: (id: string) => void;
    previewNode: (id: string | null, x?: number, y?: number, delay?: number) => void;
    createMention: (title: string, insert: (id: string) => void) => void;
    save: (sessionId: string, value: Record<string, unknown>, keepalive?: boolean) => Promise<void>;
    saveScratch: (sessionId: string, body: Paragraph[], keepalive?: boolean) => Promise<void>;
    onLiveBody?: (sessionId: string, body: Paragraph[]) => void;
    onLiveCursor?: (sessionId: string, offset: number | null) => void;
    close: () => void;
    history: () => void;
    trash: () => void;
    showContext: (x: number, y: number, items: MenuItem[]) => void;
    showNodeContext: (id: string, x: number, y: number, items?: MenuItem[]) => void;
  } = $props();

  // svelte-ignore state_referenced_locally -- the keyed card editor keeps its owning session id
  const ownedSessionId = session.id;
  let card: HTMLElement;
  // svelte-ignore state_referenced_locally -- props seed this keyed editor's local draft
  let title = $state(session.title);
  // svelte-ignore state_referenced_locally -- props seed this keyed editor's local draft
  let worldDate = $state(session.worldDate);
  // svelte-ignore state_referenced_locally -- props seed this keyed editor's local draft
  let sessionBody = $state<Paragraph[]>(normalizeBody(session.body));
  // svelte-ignore state_referenced_locally -- props seed this keyed editor's local draft
  let scratchBody = $state<Paragraph[]>(normalizeBody(scratch?.body ?? []));
  let bodyStatus = $state('');
  let noteStatus = $state('');
  let dirtyBody = $state(false);
  let dirtyNotes = $state(false);
  let dirtyHeader = $state(false);
  let bodyRevision = 0;
  let noteRevision = 0;
  let bodyStatusTimer: ReturnType<typeof setTimeout> | undefined;
  let noteStatusTimer: ReturnType<typeof setTimeout> | undefined;
  let mounted = false;
  let keepalive = false;

  let displayedStatus = $derived(
    liveUser && !dirtyBody ? t('session.liveUpdate', { name: liveUser }) : bodyStatus
  );
  let displayedStatusTone = $derived<'live' | 'saving' | 'error' | 'saved'>(
    liveUser && !dirtyBody
      ? 'live'
      : bodyStatus === t('common.saving')
        ? 'saving'
        : bodyStatus === t('errors.saveFailed')
          ? 'error'
          : 'saved'
  );

  $effect(() => {
    if (dirtyBody) return;
    const incomingBody = normalizeBody(liveBody ?? session.body);
    if (JSON.stringify(incomingBody) === JSON.stringify(sessionBody)) return;
    sessionBody = incomingBody;
  });

  $effect(() => {
    if (dirtyHeader) return;
    title = session.title;
    worldDate = session.worldDate;
  });

  $effect(() => {
    if (dirtyNotes) return;
    const incoming = normalizeBody(scratch?.body ?? []);
    if (JSON.stringify(incoming) === JSON.stringify(scratchBody)) return;
    scratchBody = incoming;
  });

  const saveBody = debounce(async (body: Paragraph[], revision: number) => {
    try {
      await save(ownedSessionId, { body }, keepalive);
      if (revision !== bodyRevision) return;
      dirtyBody = false;
      syncUnloadGuard();
      flashBody(revision);
    } catch {
      if (revision === bodyRevision) bodyStatus = t('errors.saveFailed');
    }
  }, 350);

  const saveNotes = debounce(async (body: Paragraph[], revision: number) => {
    try {
      await saveScratch(ownedSessionId, body, keepalive);
      if (revision !== noteRevision) return;
      dirtyNotes = false;
      syncUnloadGuard();
      flashNote(revision);
    } catch {
      if (revision === noteRevision) noteStatus = t('errors.saveFailed');
    }
  }, 400);

  function bodyChanged(body: Paragraph[]) {
    const revision = ++bodyRevision;
    sessionBody = body;
    dirtyBody = true;
    onLiveBody?.(ownedSessionId, body);
    syncUnloadGuard();
    clearTimeout(bodyStatusTimer);
    bodyStatus = t('common.saving');
    saveBody(body, revision);
  }

  function notesChanged(body: Paragraph[]) {
    const revision = ++noteRevision;
    scratchBody = body;
    dirtyNotes = true;
    syncUnloadGuard();
    clearTimeout(noteStatusTimer);
    noteStatus = t('common.saving');
    saveNotes(body, revision);
  }

  async function headerSave() {
    if (!dirtyHeader) return;
    try {
      await save(ownedSessionId, { title, worldDate });
    } finally {
      dirtyHeader = false;
    }
  }

  function flashBody(revision: number) {
    clearTimeout(bodyStatusTimer);
    bodyStatus = t('node.saved');
    bodyStatusTimer = setTimeout(() => {
      if (revision === bodyRevision) bodyStatus = '';
    }, 1600);
  }

  function flashNote(revision: number) {
    clearTimeout(noteStatusTimer);
    noteStatus = t('node.saved');
    noteStatusTimer = setTimeout(() => {
      if (revision === noteRevision) noteStatus = '';
    }, 1600);
  }

  function flushPending(useKeepalive = false) {
    keepalive = useKeepalive;
    void saveBody.flush();
    void saveNotes.flush();
    keepalive = false;
  }

  function flushForNavigation() {
    flushPending(true);
  }

  function syncUnloadGuard() {
    if (!mounted) return;
    if (dirtyBody || dirtyNotes) window.addEventListener('beforeunload', flushForNavigation);
    else window.removeEventListener('beforeunload', flushForNavigation);
  }

  onMount(() => {
    mounted = true;
    syncUnloadGuard();
    window.addEventListener('pagehide', flushForNavigation);
    requestAnimationFrame(() => card?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    return () => window.removeEventListener('pagehide', flushForNavigation);
  });

  onDestroy(() => {
    mounted = false;
    clearTimeout(bodyStatusTimer);
    clearTimeout(noteStatusTimer);
    onLiveCursor?.(ownedSessionId, null);
    window.removeEventListener('beforeunload', flushForNavigation);
    flushPending();
  });
</script>

<article class="session-card editing" bind:this={card}>
  <header class="editing-heading">
    <span class="session-icon" aria-hidden="true"><Icon name="session" size={16} /></span>
    <div class="session-copy">
      <div class="session-meta">
        <span>{t('session.sequence', { number: session.sequence })}</span>
        <input
          aria-label={t('session.worldDate')}
          bind:value={worldDate}
          disabled={!canWrite}
          placeholder={t('session.worldDate')}
          oninput={() => (dirtyHeader = true)}
          onblur={headerSave}
        />
      </div>
      <input
        class="title serif-title"
        aria-label={t('session.title')}
        bind:value={title}
        disabled={!canWrite}
        oninput={() => (dirtyHeader = true)}
        onblur={headerSave}
      />
    </div>
    <div class="session-actions">
      {#if canHistory}<button
          class="icon-action"
          aria-label={t('session.history')}
          onclick={history}><Icon name="clock" size={15} /></button
        >{/if}
      {#if canDelete}<button
          class="icon-action trash"
          aria-label={t('session.trash')}
          onclick={trash}><Icon name="trash" size={15} /></button
        >{/if}
      <button class="read-action" onclick={close}
        ><Icon name="eye" size={14} /> <span>{t('session.read')}</span></button
      >
    </div>
  </header>

  <div class="session-editor">
    <RichTextEditor
      body={!dirtyBody && liveBody ? liveBody : sessionBody}
      {nodes}
      {types}
      readonly={!canWrite}
      placeholder={t('session.editorPlaceholder')}
      onChange={bodyChanged}
      remoteCursors={liveCursors}
      onCursor={(offset) => onLiveCursor?.(ownedSessionId, offset)}
      {openNode}
      {previewNode}
      createNode={createMention}
      surfaceStatus={displayedStatus}
      surfaceStatusTone={displayedStatusTone}
      {showContext}
      {showNodeContext}
    />
  </div>

  <section class="notes-editor">
    <header>
      <span class="notes-icon"><Icon name="lock" size={14} /></span>
      <div>
        <b>{t('session.privateNotes', { name: currentUserName })}</b>
        <small>{t('session.privateHint')}</small>
      </div>
    </header>
    <RichTextEditor
      body={scratchBody}
      {nodes}
      {types}
      compact
      readonly={!canWrite}
      placeholder={t('session.privatePlaceholder')}
      onChange={notesChanged}
      {openNode}
      {previewNode}
      createNode={createMention}
      surfaceStatus={noteStatus}
      surfaceStatusTone={noteStatus === t('common.saving')
        ? 'saving'
        : noteStatus === t('errors.saveFailed')
          ? 'error'
          : 'saved'}
      {showContext}
      {showNodeContext}
    />
  </section>
</article>

<style>
  .session-card {
    overflow: hidden;
    margin: 10px 0 20px;
    border: 1px solid color-mix(in srgb, var(--ember) 30%, var(--line));
    border-radius: 15px;
    background: color-mix(in srgb, var(--bg-2) 62%, var(--canvas));
    box-shadow: 0 14px 38px rgba(0, 0, 0, 0.13);
  }
  .editing-heading {
    min-height: 84px;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    padding: 12px 15px 12px 17px;
    border-bottom: 1px solid var(--line);
    background: color-mix(in srgb, var(--ember-soft) 42%, var(--bg-3));
  }
  .session-icon {
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    border: 1px solid color-mix(in srgb, var(--ember) 24%, var(--line));
    border-radius: 9px;
    background: var(--ember-soft);
    color: var(--ember);
  }
  .session-copy,
  .session-meta {
    min-width: 0;
  }
  .session-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--ember);
    font: 9px var(--font-mono);
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }
  .session-meta span {
    flex: 0 0 auto;
  }
  .session-meta input {
    min-width: 0;
    width: 170px;
    height: 22px;
    padding: 0 3px;
    border: 0;
    border-bottom: 1px solid color-mix(in srgb, var(--ember) 20%, var(--line));
    outline: 0;
    background: transparent;
    color: var(--text-3);
    font: inherit;
  }
  .title {
    width: 100%;
    margin-top: 3px;
    padding: 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--text);
    font-size: 28px;
    font-weight: 400;
    line-height: 1.08;
  }
  .session-actions {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .session-actions button {
    height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--line);
    border-radius: 9px;
    background: color-mix(in srgb, var(--canvas) 70%, transparent);
    color: var(--text-3);
  }
  .session-actions button:hover {
    border-color: var(--line-2);
    color: var(--text);
  }
  .icon-action {
    width: 34px;
    padding: 0;
  }
  .session-actions .trash:hover {
    color: var(--danger);
  }
  .read-action {
    gap: 6px;
    padding: 0 10px;
    font: 9px var(--font-mono);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .session-editor {
    padding: 18px 20px 20px;
  }
  .session-editor :global(.editor) {
    min-height: 180px;
  }
  .notes-editor {
    padding: 15px 20px 20px;
    border-top: 1px solid var(--line);
    background: color-mix(in srgb, var(--canvas) 72%, var(--bg-2));
  }
  .notes-editor > header {
    display: flex;
    align-items: center;
    gap: 9px;
    margin-bottom: 10px;
  }
  .notes-icon {
    width: 29px;
    height: 29px;
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    border-radius: 8px;
    background: var(--ember-soft);
    color: var(--ember);
  }
  .notes-editor b,
  .notes-editor small {
    display: block;
  }
  .notes-editor b {
    color: var(--text-2);
    font: 9.5px var(--font-mono);
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .notes-editor small {
    margin-top: 2px;
    color: var(--text-3);
    font-size: 10.5px;
  }
  .notes-editor :global(.editor) {
    min-height: 92px;
  }
  @media (max-width: 600px) {
    .editing-heading {
      grid-template-columns: auto minmax(0, 1fr);
      gap: 10px;
      padding: 11px 13px;
    }
    .title {
      font-size: 24px;
    }
    .session-meta input {
      width: 120px;
    }
    .session-actions {
      grid-column: 1 / -1;
      justify-content: flex-end;
      padding-top: 2px;
    }
    .session-editor,
    .notes-editor {
      padding: 14px;
    }
    .session-editor :global(.editor) {
      min-height: 150px;
    }
  }
</style>
