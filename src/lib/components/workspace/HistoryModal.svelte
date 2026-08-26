<script lang="ts">
  import { onMount } from 'svelte';
  import Modal from '$lib/components/ui/Modal.svelte';
  import { bodyToText } from '$lib/domain/text';
  import { diffWords, type DiffPart } from '$lib/domain/diff';
  import type { Paragraph, VersionEntry } from '$lib/types';
  import { i18n, t } from '$lib/i18n/index.svelte';
  let {
    title,
    currentBody,
    close,
    load,
    restore
  }: {
    title: string;
    currentBody: Paragraph[];
    close: () => void;
    load: () => Promise<VersionEntry[]>;
    restore: (id: string) => Promise<void>;
  } = $props();
  let versions = $state<VersionEntry[]>([]);
  let selected = $state<VersionEntry | null>(null);
  let busy = $state(true);
  let diff = $derived<DiffPart[] | null>(
    selected ? diffWords(bodyToText(selected.snapshot.body), bodyToText(currentBody)) : []
  );
  onMount(async () => {
    try {
      versions = await load();
      selected = versions[0] ?? null;
    } finally {
      busy = false;
    }
  });
</script>

<Modal {title} eyebrow={t('history.eyebrow')} {close} wide>
  <div class="history">
    <aside>
      {#if busy}<p>{t('history.loading')}</p>{/if}{#each versions as version}<button
          class:active={selected?.id === version.id}
          onclick={() => (selected = version)}
          ><span
            >{new Date(version.createdAt).toLocaleString(i18n.locale, {
              dateStyle: 'medium',
              timeStyle: 'short'
            })}</span
          ><small>{version.byName}</small></button
        >{/each}{#if !busy && !versions.length}<p>{t('history.empty')}</p>{/if}
    </aside>
    <section>
      {#if selected}<header>
          <div>
            <b>{selected.snapshot.title}</b><small
              >{selected.snapshot.worldDate ?? selected.snapshot.summary}</small
            >
          </div>
          <button
            class="primary-button"
            onclick={async () => {
              await restore(selected!.id);
              close();
            }}>{t('history.restoreShort')}</button
          >
        </header>
        {#if diff}<div class="diff">
            {#each diff as part}<span
                class:added={part.kind === 'added'}
                class:removed={part.kind === 'removed'}
                >{part.value}
              </span>{/each}
          </div>{:else}<p class="long">
            {t('history.tooLong')}
          </p>{/if}{:else}<p class="pick">{t('history.pick')}</p>{/if}
    </section>
  </div>
</Modal>

<style>
  .history {
    height: min(470px, 65dvh);
    display: flex;
    margin: -18px;
  }
  .history > aside {
    width: 180px;
    flex: 0 0 auto;
    overflow-y: auto;
    padding: 6px;
    border-right: 1px solid var(--line);
  }
  .history > aside button {
    width: 100%;
    display: block;
    padding: 8px;
    border: 0;
    border-left: 2px solid transparent;
    border-radius: 7px;
    background: transparent;
    color: var(--text);
    text-align: left;
  }
  .history > aside button.active {
    border-left-color: var(--ember);
    background: var(--bg-3);
  }
  .history aside span {
    display: block;
    font-size: 11.5px;
  }
  .history aside small {
    font: 9px var(--font-mono);
    color: var(--text-3);
  }
  .history aside p {
    padding: 8px;
    color: var(--text-3);
    font-size: 11px;
  }
  .history > section {
    min-width: 0;
    flex: 1;
    overflow-y: auto;
    padding: 15px;
  }
  .history section header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--line);
  }
  .history section header > div {
    flex: 1;
  }
  .history section header b {
    display: block;
    font-weight: 500;
  }
  .history section header small {
    color: var(--text-3);
  }
  .diff {
    padding-top: 14px;
    color: var(--text-2);
    font-size: 13.5px;
    line-height: 1.75;
    user-select: text;
  }
  .diff .added {
    color: var(--ember);
    background: var(--ember-soft);
  }
  .diff .removed {
    color: var(--danger);
    text-decoration: line-through;
    opacity: 0.72;
  }
  .pick,
  .long {
    color: var(--text-3);
    font-size: 12px;
  }
  @media (max-width: 600px) {
    .history {
      height: 65dvh;
      flex-direction: column;
    }
    .history > aside {
      width: 100%;
      height: 120px;
      border: 0;
      border-bottom: 1px solid var(--line);
    }
  }
</style>
