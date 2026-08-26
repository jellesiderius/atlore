<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { tooltip } from '$lib/actions/tooltip';
  import type { MediaAsset, NodeType, WorldNode } from '$lib/types';
  import { nodeTypeLabel, t } from '$lib/i18n/index.svelte';

  let {
    node,
    type,
    media,
    anchor,
    open,
    connect,
    showAtlas,
    toggleReveal,
    close,
    canLink,
    canReveal
  }: {
    node: WorldNode;
    type?: NodeType;
    media: MediaAsset[];
    anchor: { x: number; y: number };
    open: () => void;
    connect: () => void;
    showAtlas: () => void;
    toggleReveal: () => void;
    close: () => void;
    canLink: boolean;
    canReveal: boolean;
  } = $props();

  let viewport = $state({
    width: typeof window === 'undefined' ? 1200 : innerWidth,
    height: typeof window === 'undefined' ? 800 : innerHeight
  });
  let image = $derived(media.find((item) => item.id === node.imageMediaId));
  let popupWidth = $derived(Math.min(316, viewport.width - 24));
  let estimatedHeight = $derived(230 + (image ? 140 : 0) + (node.tags.length ? 36 : 0));
  let left = $derived(Math.max(12, Math.min(anchor.x + 14, viewport.width - popupWidth - 12)));
  let top = $derived(
    anchor.y + estimatedHeight > viewport.height - 12
      ? Math.max(12, anchor.y - estimatedHeight - 8)
      : anchor.y + 12
  );

  onMount(() => {
    const resize = () => (viewport = { width: innerWidth, height: innerHeight });
    addEventListener('resize', resize);
    return () => removeEventListener('resize', resize);
  });
</script>

<div
  class="popover-backdrop"
  role="presentation"
  onclick={(event) => event.currentTarget === event.target && close()}
>
  <div
    class="popover"
    role="dialog"
    aria-label={t('graph.detailsFor', { title: node.title })}
    style:--node-color={type?.colorDark ?? 'var(--text-3)'}
    style:left={`${left}px`}
    style:top={`${top}px`}
    style:width={`${popupWidth}px`}
  >
    {#if image}<img class="cover" src={image.url} alt="" />{/if}
    <div class="meta-row">
      <span class="type-dot"></span>
      <span
        >{type ? nodeTypeLabel(type, 'singular') : node.type}{#if node.pinned}
          · {t('common.pinned')}{/if}</span
      >
      {#if !node.revealed}<em>✦ {t('common.secret')}</em>{/if}
      <button
        class="close"
        onclick={close}
        aria-label={t('common.close')}
        use:tooltip={t('common.close')}><Icon name="close" size={13} /></button
      >
    </div>
    <h3 class="serif-title">{node.title}</h3>
    <p class:empty={!node.summary}>{node.summary || t('graph.noSummary')}</p>
    {#if node.tags.length}<div class="tags">
        {#each node.tags as tag}<span>{tag}</span>{/each}
      </div>{/if}
    <div class="spacer"></div>
    <div class="actions">
      <button class="open" onclick={open}
        ><Icon name="session" size={14} />{t('common.open')}</button
      >
      {#if canReveal}<button class:revealed={!node.revealed} onclick={toggleReveal}
          ><Icon name={node.revealed ? 'eye-off' : 'eye'} size={14} />{node.revealed
            ? t('graph.hide')
            : t('graph.reveal')}</button
        >{/if}
      {#if canLink}<button
          class="icon-action"
          onclick={connect}
          aria-label={t('graph.connect')}
          use:tooltip={t('graph.connect')}><Icon name="link" size={15} /></button
        >{/if}
      {#if node.pinX !== null && node.pinY !== null}<button
          class="icon-action"
          onclick={showAtlas}
          aria-label={t('graph.showOnMap')}
          use:tooltip={t('graph.showOnMap')}><Icon name="atlas" size={15} /></button
        >{/if}
    </div>
  </div>
</div>

<style>
  .popover-backdrop {
    position: fixed;
    inset: 0;
    z-index: 55;
  }
  .popover {
    position: absolute;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid var(--line-2);
    border-radius: 14px;
    background: color-mix(in srgb, var(--bg-2) 96%, transparent);
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(16px);
    animation: lift-in 0.14s ease;
  }
  .cover {
    width: 100%;
    height: 140px;
    display: block;
    object-fit: cover;
  }
  .meta-row {
    min-height: 39px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 8px 0 12px;
    color: var(--text-3);
    font: 9.5px var(--font-mono);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .type-dot {
    width: 9px;
    height: 9px;
    flex: 0 0 auto;
    border-radius: 50%;
    background: var(--node-color);
  }
  .meta-row > span:nth-child(2) {
    min-width: 0;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .meta-row em {
    color: var(--ember);
    font-style: normal;
    letter-spacing: 0.04em;
  }
  .close {
    width: 28px;
    height: 28px;
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: transparent;
    color: var(--text-2);
  }
  h3 {
    margin: 5px 12px 0;
    font-size: 22px;
    line-height: 1.2;
    font-weight: 400;
    text-wrap: pretty;
  }
  p {
    margin: 7px 12px 0;
    color: var(--text-2);
    font-size: 13px;
    line-height: 1.55;
    text-wrap: pretty;
  }
  p.empty {
    color: var(--text-3);
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 9px 12px 0;
  }
  .tags span {
    min-height: 24px;
    display: inline-flex;
    align-items: center;
    padding: 0 7px;
    border: 1px solid var(--line);
    border-radius: 6px;
    color: var(--text-3);
    font-size: 11px;
  }
  .spacer {
    height: 12px;
  }
  .actions {
    display: flex;
    gap: 5px;
    padding: 8px;
    border-top: 1px solid var(--line);
  }
  .actions button {
    min-height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border: 1px solid var(--line);
    border-radius: 9px;
    background: transparent;
    color: var(--text-3);
    font-size: 12.5px;
  }
  .actions .open {
    flex: 1;
    border-color: transparent;
    background: var(--ember);
    color: #1a1206;
    font-weight: 600;
  }
  .actions button:not(.open):not(.icon-action) {
    flex: 1;
  }
  .actions .revealed {
    border-color: #63b39d;
    background: rgba(99, 179, 157, 0.16);
    color: #63b39d;
  }
  .actions .icon-action {
    width: 38px;
    flex: 0 0 38px;
  }
  .actions button:hover,
  .close:hover {
    border-color: var(--ember);
    color: var(--ember);
  }
  .actions .open:hover {
    color: #1a1206;
    filter: brightness(1.06);
  }
</style>
