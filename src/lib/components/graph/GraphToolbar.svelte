<script lang="ts">
  import Icon from '$lib/components/ui/Icon.svelte';
  import { tooltip } from '$lib/actions/tooltip';
  import { t } from '$lib/i18n/index.svelte';
  let {
    fit,
    reflow,
    newNode,
    canCreate
  }: { fit: () => void; reflow: () => void; newNode: () => void; canCreate: boolean } = $props();
</script>

<div class="toolbar">
  <button onclick={fit} aria-label={t('graph.fit')} use:tooltip={t('graph.fit')}
    ><Icon name="fit" size={16} /></button
  ><button onclick={reflow} aria-label={t('graph.reflow')} use:tooltip={t('graph.reflow')}
    ><Icon name="undo" size={16} /></button
  >{#if canCreate}<span></span><button class="new" onclick={newNode}
      ><Icon name="plus" size={15} /> {t('graph.addNode')}</button
    >{/if}
</div>

<style>
  .toolbar {
    position: absolute;
    z-index: 12;
    right: 12px;
    top: 12px;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px;
    border: 1px solid var(--line);
    border-radius: 11px;
    background: color-mix(in srgb, var(--bg-2) 87%, transparent);
    backdrop-filter: blur(8px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
  }
  button {
    min-width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--text-3);
  }
  button:hover {
    background: var(--bg-3);
    color: var(--text);
  }
  span {
    width: 1px;
    height: 20px;
    background: var(--line);
  }
  button.new {
    padding: 0 9px;
    color: var(--ember);
    font-size: 12px;
  }
  @media (max-width: 600px) {
    .toolbar {
      right: 8px;
      top: 8px;
    }
    .toolbar button.new {
      font-size: 0;
      padding: 0;
      min-width: 32px;
    }
  }
</style>
