<script lang="ts">
  import RichTextView from '$lib/components/richtext/RichTextView.svelte';
  import type { NodeType, SessionEntry, SessionScratch, WorldNode } from '$lib/types';
  import { t } from '$lib/i18n/index.svelte';
  let {
    sessions,
    scratch,
    nodes,
    types,
    currentUserName,
    openNode,
    previewNode,
    openSession
  }: {
    sessions: SessionEntry[];
    scratch: SessionScratch[];
    nodes: WorldNode[];
    types: NodeType[];
    currentUserName: string;
    openNode: (id: string) => void;
    previewNode: (id: string | null, x?: number, y?: number, delay?: number) => void;
    openSession: (id: string) => void;
  } = $props();
  let scratchMap = $derived(new Map(scratch.map((item) => [item.sessionId, item])));
</script>

<section class="story">
  <header>
    <div>
      <span class="eyebrow">{t('story.title')}</span>
      <h1 class="serif-title">{t('story.heading')}</h1>
    </div>
    <span>{t('story.count', { count: sessions.filter((item) => !item.trashedAt).length })}</span>
  </header>
  <div class="scroll">
    {#each sessions.filter((item) => !item.trashedAt) as session}<article>
        <button class="session-heading" onclick={() => openSession(session.id)}
          ><span>{t('session.sequence', { number: session.sequence })} · {session.worldDate}</span>
          <h2 class="serif-title">{session.title}</h2></button
        ><RichTextView
          body={session.body}
          {nodes}
          {types}
          {previewNode}
          {openNode}
        />{#if scratchMap.has(session.id)}<details>
            <summary>{t('story.privateNotes', { name: currentUserName })}</summary><RichTextView
              body={scratchMap.get(session.id)?.body ?? []}
              {nodes}
              {types}
              {previewNode}
              surface="compact"
              {openNode}
            />
          </details>{/if}
      </article>{/each}{#if !sessions.filter((item) => !item.trashedAt).length}<p class="empty">
        {t('story.noSessions')}
      </p>{/if}
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
    height: 78px;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 0 max(20px, calc((100% - 780px) / 2));
    border-bottom: 1px solid var(--line);
  }
  .story > header > div {
    flex: 1;
  }
  .story h1 {
    margin: 2px 0 0;
    font-size: 26px;
    font-weight: 400;
  }
  .story > header > span {
    font: 9px var(--font-mono);
    color: var(--text-3);
    text-transform: uppercase;
  }
  .scroll {
    flex: 1;
    overflow-y: auto;
    padding: 20px max(20px, calc((100% - 780px) / 2)) 120px;
  }
  .scroll article {
    position: relative;
    padding: 30px 0 35px;
    border-bottom: 1px solid var(--line);
  }
  .scroll article::before {
    content: '';
    position: absolute;
    left: -21px;
    top: 36px;
    width: 6px;
    height: 6px;
    transform: rotate(45deg);
    background: var(--ember);
    opacity: 0.6;
  }
  .session-heading {
    display: block;
    margin-bottom: 20px;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--text);
    text-align: left;
  }
  .session-heading span {
    font: 9px var(--font-mono);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ember);
  }
  .session-heading h2 {
    margin: 5px 0 0;
    font-size: 32px;
    font-weight: 400;
  }
  .scroll :global(.rich-view) {
    font-size: 15.5px;
    line-height: 1.8;
  }
  .scroll details {
    margin-top: 22px;
    padding: 12px;
    border: 1px dashed var(--line);
    border-radius: 9px;
  }
  .scroll summary {
    cursor: pointer;
    color: var(--text-3);
    font: 9.5px var(--font-mono);
    text-transform: uppercase;
  }
  .scroll details :global(.rich-view) {
    margin-top: 10px;
    font-size: 13px;
  }
  .empty {
    color: var(--text-3);
    text-align: center;
    margin-top: 15vh;
  }
  @media (max-width: 600px) {
    .story > header {
      padding: 0 16px;
    }
    .scroll {
      padding: 12px 18px 100px;
    }
    .scroll article::before {
      display: none;
    }
    .session-heading h2 {
      font-size: 29px;
    }
  }
</style>
