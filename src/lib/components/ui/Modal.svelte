<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from './Icon.svelte';
  import { tooltip } from '$lib/actions/tooltip';
  import { t } from '$lib/i18n/index.svelte';
  let {
    title,
    eyebrow = '',
    wide = false,
    close,
    children,
    footer
  }: {
    title: string;
    eyebrow?: string;
    wide?: boolean;
    close: () => void;
    children: import('svelte').Snippet;
    footer?: import('svelte').Snippet;
  } = $props();

  onMount(() => {
    const listener = (event: KeyboardEvent) => event.key === 'Escape' && close();
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  });
</script>

<div
  class="modal-backdrop"
  role="presentation"
  onclick={(event) => event.currentTarget === event.target && close()}
>
  <div class:wide class="panel-surface modal" role="dialog" aria-modal="true" aria-label={title}>
    <header>
      <div>
        {#if eyebrow}<div class="eyebrow">{eyebrow}</div>{/if}
        <h2 class="serif-title">{title}</h2>
      </div>
      <button
        class="icon-button"
        aria-label={t('common.close')}
        use:tooltip={t('common.close')}
        onclick={close}><Icon name="close" size={16} /></button
      >
    </header>
    <div class="modal-content">{@render children()}</div>
    {#if footer}<footer>{@render footer()}</footer>{/if}
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 80;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 18px;
    background: rgba(6, 8, 11, 0.68);
    backdrop-filter: blur(3px);
    animation: fade-in 0.14s ease;
  }
  .modal {
    width: min(500px, 100%);
    max-height: min(760px, calc(100dvh - 36px));
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: lift-in 0.2s var(--ease-atlore);
  }
  .modal.wide {
    width: min(820px, 100%);
  }
  header {
    display: flex;
    align-items: center;
    gap: 16px;
    flex: 0 0 auto;
    padding: 16px 18px;
    border-bottom: 1px solid var(--line);
  }
  header > div {
    min-width: 0;
    flex: 1;
  }
  .eyebrow {
    margin-bottom: 4px;
  }
  h2 {
    margin: 0;
    font-size: 25px;
    line-height: 1.1;
  }
  .modal-content {
    min-height: 0;
    overflow-y: auto;
    padding: 18px;
  }
  footer {
    padding: 13px 18px;
    border-top: 1px solid var(--line);
  }
</style>
