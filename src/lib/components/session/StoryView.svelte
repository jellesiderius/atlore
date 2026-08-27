<script lang="ts">
  import Icon from '$lib/components/ui/Icon.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';
  import type { MenuItem } from '$lib/components/ui/ContextMenu.svelte';
  import RichTextView from '$lib/components/richtext/RichTextView.svelte';
  import SessionStoryEditor from '$lib/components/session/SessionStoryEditor.svelte';
  import type { NodeType, Paragraph, SessionEntry, SessionScratch, WorldNode } from '$lib/types';
  import { t } from '$lib/i18n/index.svelte';
  let {
    sessions,
    scratch,
    nodes,
    types,
    currentUserName,
    editingSessionId,
    liveBodies = {},
    liveUsers = {},
    liveCursors = {},
    canWrite,
    canStart,
    canHistory,
    canDelete,
    openNode,
    previewNode,
    createMention,
    editSession,
    closeEditor,
    createSession,
    save,
    saveScratch,
    onLiveBody,
    onLiveCursor,
    history,
    trash,
    showContext,
    showNodeContext
  }: {
    sessions: SessionEntry[];
    scratch: SessionScratch[];
    nodes: WorldNode[];
    types: NodeType[];
    currentUserName: string;
    editingSessionId: string | null;
    liveBodies?: Record<string, Paragraph[] | undefined>;
    liveUsers?: Record<string, string | undefined>;
    liveCursors?: Record<
      string,
      { userId: string; userName: string; userColor: string; offset: number }[]
    >;
    canWrite: boolean;
    canStart: boolean;
    canHistory: boolean;
    canDelete: boolean;
    openNode: (id: string) => void;
    previewNode: (id: string | null, x?: number, y?: number, delay?: number) => void;
    createMention: (title: string, insert: (id: string) => void) => void;
    editSession: (id: string) => void;
    closeEditor: () => void;
    createSession: () => void;
    save: (sessionId: string, value: Record<string, unknown>, keepalive?: boolean) => Promise<void>;
    saveScratch: (sessionId: string, body: Paragraph[], keepalive?: boolean) => Promise<void>;
    onLiveBody?: (sessionId: string, body: Paragraph[]) => void;
    onLiveCursor?: (sessionId: string, offset: number | null) => void;
    history: (session: SessionEntry) => void;
    trash: (session: SessionEntry) => void;
    showContext: (x: number, y: number, items: MenuItem[]) => void;
    showNodeContext: (id: string, x: number, y: number, items?: MenuItem[]) => void;
  } = $props();
  let scratchMap = $derived(new Map(scratch.map((item) => [item.sessionId, item])));

  function hasContent(body: Paragraph[]) {
    return body.some((paragraph) =>
      paragraph.segs.some((segment) => segment.t === 'ref' || segment.v.trim().length > 0)
    );
  }
</script>

<section class="story">
  <header>
    <h1 class="serif-title">{t('story.heading')}</h1>
    <div class="header-tools">
      <span>{t('story.count', { count: sessions.filter((item) => !item.trashedAt).length })}</span>
      {#if canStart}<button class="new-session" onclick={createSession}
          ><Icon name="plus" size={15} /> {t('session.new')}</button
        >{/if}
    </div>
  </header>
  <div class="scroll">
    {#each sessions.filter((item) => !item.trashedAt) as session (session.id)}
      {#if editingSessionId === session.id}
        <SessionStoryEditor
          {session}
          scratch={scratchMap.get(session.id)}
          {nodes}
          {types}
          {currentUserName}
          liveBody={liveBodies[session.id]}
          liveUser={liveUsers[session.id]}
          liveCursors={liveCursors[session.id] ?? []}
          {canWrite}
          {canHistory}
          {canDelete}
          {openNode}
          {previewNode}
          {createMention}
          {save}
          {saveScratch}
          {onLiveBody}
          {onLiveCursor}
          close={closeEditor}
          history={() => history(session)}
          trash={() => trash(session)}
          {showContext}
          {showNodeContext}
        />
      {:else}
        {@const readerBody = liveBodies[session.id] ?? session.body}
        <article class="session-card">
          <header class="session-heading">
            <button class="session-open" onclick={() => editSession(session.id)}
              ><span class="session-icon" aria-hidden="true"><Icon name="session" size={16} /></span
              ><span class="session-copy"
                ><span class="session-meta"
                  >{t('session.sequence', { number: session.sequence })}{#if session.worldDate}
                    · {session.worldDate}{/if}</span
                >
                <h2 class="serif-title">{session.title}</h2></span
              ></button
            >
            {#if canWrite}<button class="write-action" onclick={() => editSession(session.id)}
                ><Icon name="edit" size={14} /> <span>{t('common.edit')}</span></button
              >{:else}<span class="reader-mode"
                ><Icon name="eye" size={13} />{t('editor.readSurface')}</span
              >{/if}
          </header>
          <div class="session-reader" aria-label={t('editor.readSurface')}>
            {#if hasContent(readerBody)}<RichTextView
                body={readerBody}
                {nodes}
                {types}
                remoteCursors={liveCursors[session.id] ?? []}
                {previewNode}
                surface="plain"
                {openNode}
              />{:else}<EmptyState
                icon="session"
                heading={t('session.blankHeading')}
                text={t('session.blankText')}
                actionLabel={canWrite ? t('session.blankAction') : ''}
                action={canWrite ? () => editSession(session.id) : undefined}
                compact
                testId={`session-empty-${session.id}`}
              />{/if}
          </div>
          {#if scratchMap.has(session.id)}<details class="session-notes">
              <summary
                ><span class="summary-chevron" aria-hidden="true"></span><span class="notes-label"
                  ><b>{t('story.privateNotes', { name: currentUserName })}</b><small
                    >{t('session.privateHint')}</small
                  ></span
                ><Icon name="lock" size={14} /></summary
              >
              <div class="notes-content">
                <RichTextView
                  body={scratchMap.get(session.id)?.body ?? []}
                  {nodes}
                  {types}
                  {previewNode}
                  surface="plain"
                  {openNode}
                />
              </div>
            </details>{/if}
        </article>
      {/if}
    {/each}{#if !sessions.filter((item) => !item.trashedAt).length}<div class="no-sessions">
        <EmptyState
          icon="session"
          heading={t('session.emptyHeading')}
          text={t('session.emptyText')}
          actionLabel={canStart ? t('session.first') : ''}
          action={canStart ? createSession : undefined}
          testId="sessions-empty-state"
        />
      </div>{/if}
  </div>
</section>

<style>
  .story {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: var(--canvas);
  }
  .story > header {
    height: 62px;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 0 max(20px, calc((100% - 780px) / 2));
    border-bottom: 1px solid var(--line);
  }
  .story h1 {
    flex: 1;
    margin: 0;
    font-size: 26px;
    font-weight: 400;
  }
  .header-tools {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .header-tools > span {
    font: 9px var(--font-mono);
    color: var(--text-3);
    text-transform: uppercase;
  }
  .new-session,
  .write-action {
    height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 0 11px;
    border: 1px solid color-mix(in srgb, var(--ember) 24%, var(--line));
    border-radius: 9px;
    background: var(--ember-soft);
    color: var(--ember);
    font: 9px var(--font-mono);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .new-session:hover,
  .write-action:hover {
    border-color: color-mix(in srgb, var(--ember) 50%, var(--line));
    background: color-mix(in srgb, var(--ember) 15%, var(--bg-3));
  }
  .scroll {
    flex: 1;
    overflow-y: auto;
    padding: 20px max(20px, calc((100% - 780px) / 2)) 120px;
  }
  .session-card {
    overflow: hidden;
    margin: 10px 0 20px;
    border: 1px solid var(--line);
    border-radius: 15px;
    background: color-mix(in srgb, var(--bg-2) 62%, var(--canvas));
    box-shadow: 0 12px 34px rgba(0, 0, 0, 0.1);
  }
  .session-heading {
    width: 100%;
    min-height: 76px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    padding: 0 15px 0 0;
    border-bottom: 1px solid var(--line);
    background: color-mix(in srgb, var(--bg-3) 32%, transparent);
    color: var(--text);
  }
  .session-heading:hover {
    background: color-mix(in srgb, var(--bg-3) 58%, transparent);
  }
  .session-open {
    min-width: 0;
    min-height: 75px;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 12px;
    padding: 13px 17px;
    border: 0;
    background: transparent;
    color: var(--text);
    text-align: left;
  }
  .session-icon {
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    border: 1px solid color-mix(in srgb, var(--ember) 22%, var(--line));
    border-radius: 9px;
    background: var(--ember-soft);
    color: var(--ember);
  }
  .session-copy {
    min-width: 0;
  }
  .session-meta {
    display: block;
    font: 9px var(--font-mono);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ember);
  }
  .session-heading h2 {
    overflow: hidden;
    margin: 3px 0 0;
    font-size: 28px;
    font-weight: 400;
    line-height: 1.08;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .write-action {
    flex: 0 0 auto;
  }
  .reader-mode {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--text-3);
    font: 8.5px var(--font-mono);
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }
  .session-reader {
    padding: 18px 20px 20px;
  }
  .session-reader :global(.rich-view) {
    font-size: 15.5px;
    line-height: 1.8;
  }
  .session-notes {
    border-top: 1px solid var(--line);
    background: color-mix(in srgb, var(--canvas) 72%, var(--bg-2));
  }
  .session-notes summary {
    min-height: 52px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 17px;
    cursor: pointer;
    color: var(--text-3);
    list-style: none;
  }
  .session-notes summary::-webkit-details-marker {
    display: none;
  }
  .session-notes summary:hover {
    background: color-mix(in srgb, var(--bg-3) 34%, transparent);
  }
  .summary-chevron {
    width: 7px;
    height: 7px;
    flex: 0 0 auto;
    border-right: 1.5px solid currentColor;
    border-bottom: 1.5px solid currentColor;
    transform: rotate(-45deg);
    transition: transform 0.15s ease;
  }
  .session-notes[open] .summary-chevron {
    transform: rotate(45deg) translate(-1px, -1px);
  }
  .notes-label {
    min-width: 0;
    flex: 1;
  }
  .notes-label b,
  .notes-label small {
    display: block;
  }
  .notes-label b {
    color: var(--text-2);
    font: 9.5px var(--font-mono);
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .notes-label small {
    overflow: hidden;
    margin-top: 2px;
    font-size: 10.5px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .notes-content {
    padding: 0 20px 18px 34px;
  }
  .notes-content :global(.rich-view) {
    padding-top: 14px;
    border-top: 1px solid color-mix(in srgb, var(--line) 70%, transparent);
    font-size: 13.5px;
    line-height: 1.7;
  }
  .no-sessions {
    min-height: min(460px, calc(100dvh - 210px));
    display: grid;
    place-items: center;
  }
  @media (max-width: 600px) {
    .story > header {
      padding: 0 16px;
    }
    .story h1 {
      font-size: 23px;
    }
    .header-tools {
      gap: 7px;
    }
    .header-tools > span {
      display: none;
    }
    .new-session {
      width: 36px;
      padding: 0;
      font-size: 0;
    }
    .scroll {
      padding: 12px 18px 100px;
    }
    .session-heading {
      min-height: 68px;
      padding-right: 10px;
    }
    .session-open {
      min-height: 67px;
      gap: 10px;
      padding: 11px 10px 11px 13px;
    }
    .session-heading h2 {
      font-size: 25px;
    }
    .reader-mode {
      font-size: 0;
    }
    .write-action {
      width: 34px;
      padding: 0;
      font-size: 0;
    }
    .session-reader {
      padding: 15px 16px 17px;
    }
    .session-notes summary {
      padding-inline: 14px;
    }
    .notes-content {
      padding: 0 16px 16px 31px;
    }
  }
</style>
