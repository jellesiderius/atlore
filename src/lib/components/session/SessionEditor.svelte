<script lang="ts">
  import Icon from '$lib/components/ui/Icon.svelte';
  import RichTextEditor from '$lib/components/richtext/RichTextEditor.svelte';
  import { debounce } from '$lib/client/api';
  import { referencedNodeIds } from '$lib/domain/text';
  import type {
    NodePost,
    NodeType,
    Paragraph,
    SessionEntry,
    SessionScratch,
    WorldLink,
    WorldNode
  } from '$lib/types';
  import { t } from '$lib/i18n/index.svelte';
  let {
    session,
    sessions,
    scratch,
    nodes,
    links,
    types,
    posts,
    currentUserName,
    canWrite,
    canStart,
    canHistory,
    canDelete,
    canLink,
    openNode,
    createMention,
    pick,
    save,
    saveScratch,
    createSession,
    trash,
    history,
    connect
  }: {
    session: SessionEntry | null;
    sessions: SessionEntry[];
    scratch?: SessionScratch;
    nodes: WorldNode[];
    links: WorldLink[];
    types: NodeType[];
    posts: NodePost[];
    currentUserName: string;
    canWrite: boolean;
    canStart: boolean;
    canHistory: boolean;
    canDelete: boolean;
    canLink: boolean;
    openNode: (id: string) => void;
    createMention: (title: string, insert: (id: string) => void) => void;
    pick: (id: string) => void;
    save: (value: Record<string, unknown>) => Promise<void>;
    saveScratch: (body: Paragraph[]) => Promise<void>;
    createSession: () => void;
    trash: () => void;
    history: () => void;
    connect: (a: string, b: string) => Promise<void>;
  } = $props();
  // svelte-ignore state_referenced_locally -- the keyed session editor owns its edit buffer
  let title = $state(session?.title ?? '');
  // svelte-ignore state_referenced_locally -- the keyed session editor owns its edit buffer
  let worldDate = $state(session?.worldDate ?? '');
  let saved = $state('');
  // svelte-ignore state_referenced_locally -- the keyed session editor owns its edit buffer
  let sessionBody = $state<Paragraph[]>(session?.body ?? [{ segs: [{ t: 'txt', v: '' }] }]);
  // svelte-ignore state_referenced_locally -- the keyed session editor owns its edit buffer
  let scratchBody = $state<Paragraph[]>(scratch?.body ?? [{ segs: [{ t: 'txt', v: '' }] }]);
  let refs = $derived(referencedNodeIds(sessionBody));
  let linkedPairs = $derived(
    new Set(links.map((link) => [link.sourceId, link.targetId].sort().join(':')))
  );
  let pairs = $derived(buildPairs([...refs], linkedPairs).slice(0, 8));
  let relatedPosts = $derived(posts.filter((post) => refs.has(post.nodeId)));
  const saveBody = debounce(async (body: Paragraph[]) => {
    sessionBody = body;
    await save({ body });
    flash();
  }, 650);
  const saveNotes = debounce(async (body: Paragraph[]) => {
    scratchBody = body;
    await saveScratch(body);
    flash();
  }, 700);
  async function headerSave() {
    await save({ title, worldDate });
    flash();
  }
  function flash() {
    saved = t('node.saved');
    setTimeout(() => (saved = ''), 1600);
  }
  function buildPairs(ids: string[], linked: Set<string>) {
    const result: [string, string][] = [];
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++)
        if (!linked.has([ids[i], ids[j]].sort().join(':'))) result.push([ids[i], ids[j]]);
    return result;
  }
</script>

<section class="session-view">
  <header class="session-bar">
    <select
      value={session?.id ?? ''}
      onchange={(event) => pick(event.currentTarget.value)}
      disabled={!sessions.length}
      >{#each sessions.filter((item) => !item.trashedAt) as item}<option value={item.id}
          >{t('session.sequence', { number: item.sequence })} · {item.title}</option
        >{/each}</select
    >{#if session && canHistory}<button
        class="icon-button"
        title={t('session.history')}
        onclick={history}><Icon name="clock" size={16} /></button
      >{/if}{#if session && canDelete}<button
        class="icon-button trash"
        title={t('session.trash')}
        onclick={trash}><Icon name="trash" size={16} /></button
      >{/if}<span>{saved}</span>{#if canStart}<button
        class="primary-button start"
        onclick={createSession}><Icon name="plus" size={15} /> {t('session.start')}</button
      >{/if}
  </header>
  {#if session}<div class="scroll">
      <article>
        <div class="session-meta">
          <span class="eyebrow">{t('session.sequence', { number: session.sequence })}</span><input
            bind:value={worldDate}
            disabled={!canWrite}
            placeholder={t('session.worldDate')}
            onblur={headerSave}
          />
        </div>
        <input
          class="title serif-title"
          aria-label={t('session.title')}
          bind:value={title}
          disabled={!canWrite}
          onblur={headerSave}
        /><RichTextEditor
          body={sessionBody}
          {nodes}
          {types}
          readonly={!canWrite}
          placeholder={t('session.editorPlaceholder')}
          onChange={saveBody}
          {openNode}
          createNode={createMention}
        />
        {#if canLink && pairs.length}<section class="suggestions">
            <header>
              <span class="eyebrow">{t('session.unconnected')}</span><button
                onclick={async () => {
                  for (const [a, b] of pairs) await connect(a, b);
                }}>{t('session.connectAll', { count: pairs.length })}</button
              >
            </header>
            <div>
              {#each pairs as [a, b]}{@const an = nodes.find((node) => node.id === a)}{@const bn =
                  nodes.find((node) => node.id === b)}{#if an && bn}<button
                    onclick={() => connect(a, b)}
                    ><span style:background={types.find((type) => type.key === an.type)?.colorDark}
                    ></span>{an.title}<i>↔</i><span
                      style:background={types.find((type) => type.key === bn.type)?.colorDark}
                    ></span>{bn.title}</button
                  >{/if}{/each}
            </div>
          </section>{/if}
        <section class="scratch">
          <div class="scratch-head">
            <span style:background="var(--ember)"></span>
            <div>
              <div class="eyebrow">{t('session.privateNotes', { name: currentUserName })}</div>
              <small>{t('session.privateHint')}</small>
            </div>
          </div>
          <RichTextEditor
            body={scratchBody}
            {nodes}
            {types}
            readonly={!canWrite}
            placeholder={t('session.privatePlaceholder')}
            onChange={saveNotes}
            {openNode}
            createNode={createMention}
          />
        </section>
        {#if relatedPosts.length}<section class="related-notes">
            <div class="eyebrow">{t('session.relatedNotes')}</div>
            {#each relatedPosts as post}{@const node = nodes.find(
                (item) => item.id === post.nodeId
              )}<button onclick={() => node && openNode(node.id)}
                ><span style:background={types.find((type) => type.key === node?.type)?.colorDark}
                ></span>
                <div>
                  <b>{node?.title}</b>
                  <p>{post.text}</p>
                </div>
                <small>{t(`node.postKind.${post.kind}`)}</small></button
              >{/each}
          </section>{/if}
      </article>
    </div>{:else}<div class="empty">
      <Icon name="session" size={38} />
      <h2 class="serif-title">{t('session.emptyHeading')}</h2>
      <p>{t('session.emptyText')}</p>
      {#if canStart}<button class="primary-button" onclick={createSession}
          >+ {t('session.first')}</button
        >{/if}
    </div>{/if}
</section>

<style>
  .session-view {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: var(--canvas);
  }
  .session-bar {
    height: 56px;
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--line);
    background: var(--canvas);
  }
  .session-bar select {
    min-width: 240px;
    max-width: 50%;
    height: 38px;
    padding: 0 9px;
    border: 1px solid var(--line);
    border-radius: 9px;
    background: var(--bg-3);
    font-size: 12.5px;
  }
  .session-bar .trash {
    color: var(--danger);
  }
  .session-bar > span {
    flex: 1;
    color: var(--text-3);
    font: 9.5px var(--font-mono);
    text-align: center;
  }
  .start {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .scroll {
    flex: 1;
    overflow-y: auto;
  }
  .scroll > article {
    width: min(780px, 100%);
    min-height: 100%;
    margin: 0 auto;
    padding: 44px 30px 120px;
  }
  .session-meta {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .session-meta .eyebrow {
    flex: 1;
  }
  .session-meta input {
    width: 220px;
    border: 0;
    border-bottom: 1px solid var(--line);
    outline: 0;
    background: transparent;
    color: var(--text-3);
    font: 10.5px var(--font-mono);
    text-align: right;
  }
  .title {
    width: 100%;
    margin: 8px 0 24px;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--text);
    font-size: 38px;
    line-height: 1.08;
  }
  .suggestions {
    margin-top: 22px;
    padding: 12px 13px;
    border: 1px dashed var(--line-2);
    border-radius: 12px;
  }
  .suggestions header {
    display: flex;
    align-items: center;
    margin-bottom: 9px;
  }
  .suggestions header span {
    flex: 1;
  }
  .suggestions header button {
    border: 0;
    background: transparent;
    color: var(--ember);
    font-size: 11px;
  }
  .suggestions > div {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .suggestions > div button {
    min-height: 30px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 9px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--bg-3);
    color: var(--text-2);
    font-size: 11.5px;
  }
  .suggestions button span {
    width: 5px;
    height: 5px;
    border-radius: 50%;
  }
  .suggestions i {
    color: var(--text-3);
    font-style: normal;
  }
  .scratch {
    margin-top: 36px;
    padding-top: 20px;
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
  .scratch :global(.editor) {
    min-height: 100px;
  }
  .related-notes {
    margin-top: 26px;
  }
  .related-notes > button {
    width: 100%;
    min-height: 48px;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 8px;
    border: 0;
    border-radius: 8px;
    background: var(--bg-2);
    color: var(--text-2);
    text-align: left;
    margin-top: 5px;
  }
  .related-notes > button > span {
    width: 7px;
    height: 7px;
    margin-top: 5px;
    border-radius: 50%;
  }
  .related-notes > button > div {
    min-width: 0;
    flex: 1;
  }
  .related-notes b {
    font-size: 12px;
  }
  .related-notes p {
    margin: 2px 0;
    font-size: 11.5px;
  }
  .related-notes small {
    font: 8px var(--font-mono);
    text-transform: uppercase;
    color: var(--text-3);
  }
  .empty {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--text-3);
    text-align: center;
  }
  .empty h2 {
    margin: 12px 0 4px;
    color: var(--text);
    font-size: 29px;
    font-weight: 400;
  }
  .empty p {
    margin: 0 0 18px;
  }
  @media (max-width: 600px) {
    .session-bar {
      padding: 7px;
    }
    .session-bar select {
      min-width: 0;
      max-width: none;
      flex: 1;
    }
    .session-bar > span {
      display: none;
    }
    .start {
      font-size: 0;
      min-width: 40px;
      padding: 0;
      justify-content: center;
    }
    .scroll > article {
      padding: 28px 16px 100px;
    }
    .title {
      font-size: 32px;
    }
    .session-meta input {
      width: 150px;
    }
  }
</style>
