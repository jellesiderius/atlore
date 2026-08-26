<script lang="ts">
  import type { NodeType, WorldNode } from '$lib/types';
  import { t } from '$lib/i18n/index.svelte';
  let {
    node,
    type,
    secret = false,
    onclick,
    previewNode
  }: {
    node?: WorldNode;
    type?: NodeType;
    secret?: boolean;
    onclick?: () => void;
    previewNode?: (id: string | null, x?: number, y?: number, delay?: number) => void;
  } = $props();
</script>

<span class="chip-wrap">
  <button
    class:secret
    type="button"
    style:--chip-color-dark={type?.colorDark ?? 'var(--text-3)'}
    style:--chip-color-light={type?.colorLight ?? 'var(--text-3)'}
    aria-label={secret || !node
      ? t('editor.secretNode')
      : t('editor.openNode', { title: node.title })}
    onpointerenter={(event) => {
      if (!node || secret) return;
      const rect = event.currentTarget.getBoundingClientRect();
      previewNode?.(node.id, rect.left - 12, rect.bottom + 8, 300);
    }}
    onpointerleave={() => previewNode?.(null)}
    {onclick}>{secret || !node ? `✦ ${t('editor.secret')}` : node.title}</button
  >
</span>

<style>
  .chip-wrap {
    position: relative;
    display: inline-flex;
  }
  button {
    --chip-color: var(--chip-color-dark);
    display: inline-flex;
    align-items: center;
    min-height: 24px;
    margin: 0 2px;
    padding: 1px 6px;
    border: 0;
    border-radius: 5px;
    background: color-mix(in srgb, var(--chip-color) 13%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--chip-color) 24%, transparent);
    color: var(--chip-color);
    font: inherit;
    line-height: 1.25;
    vertical-align: baseline;
    cursor: pointer;
    transition:
      background 0.12s,
      box-shadow 0.12s;
  }
  :global(:root[data-theme='light']) button {
    --chip-color: var(--chip-color-light);
  }
  button:hover {
    background: color-mix(in srgb, var(--chip-color) 20%, transparent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--chip-color) 18%, transparent);
  }
  button.secret {
    color: var(--text-3);
    font-style: italic;
  }
</style>
