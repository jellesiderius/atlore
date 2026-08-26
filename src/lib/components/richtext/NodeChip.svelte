<script lang="ts">
  import type { NodeType, WorldNode } from '$lib/types';
  let {
    node,
    type,
    secret = false,
    onclick
  }: { node?: WorldNode; type?: NodeType; secret?: boolean; onclick?: () => void } = $props();
  let color = $derived(type?.colorDark ?? 'var(--text-3)');
</script>

<span class="chip-wrap">
  <button
    class:secret
    type="button"
    style:--chip-color={color}
    aria-label={secret || !node ? 'Geheime node' : `${node.title} openen`}
    {onclick}>{secret || !node ? '✦ geheim' : node.title}</button
  >
  {#if node && !secret}
    <span class="hover-card" role="tooltip" style:--chip-color={color}>
      <small><i></i>{type?.one ?? node.type}</small>
      <b>{node.title}</b>
      <em>{node.summary || 'Nog geen samenvatting.'}</em>
    </span>
  {/if}
</span>

<style>
  .chip-wrap {
    position: relative;
    display: inline-flex;
  }
  button {
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
  button:hover {
    background: color-mix(in srgb, var(--chip-color) 20%, transparent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--chip-color) 18%, transparent);
  }
  button.secret {
    color: var(--text-3);
    font-style: italic;
  }
  .hover-card {
    position: absolute;
    z-index: 60;
    left: 50%;
    bottom: calc(100% + 8px);
    width: 220px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 10px 11px;
    border: 1px solid var(--line-2);
    border-radius: 9px;
    background: color-mix(in srgb, var(--bg-2) 96%, transparent);
    box-shadow: 0 14px 38px rgba(0, 0, 0, 0.45);
    color: var(--text);
    opacity: 0;
    pointer-events: none;
    transform: translate(-50%, 4px);
    transition:
      opacity 0.12s,
      transform 0.12s;
  }
  .chip-wrap:hover .hover-card,
  .chip-wrap:focus-within .hover-card {
    opacity: 1;
    transform: translate(-50%, 0);
  }
  .hover-card small {
    display: flex;
    align-items: center;
    gap: 5px;
    color: var(--chip-color);
    font: 8px var(--font-mono);
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }
  .hover-card i {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--chip-color);
  }
  .hover-card b {
    font: 18px var(--font-serif);
    font-weight: 400;
  }
  .hover-card em {
    color: var(--text-2);
    font-size: 11px;
    font-style: normal;
    line-height: 1.4;
  }
</style>
