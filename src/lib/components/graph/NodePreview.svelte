<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import type { MediaAsset, NodeType, WorldNode } from '$lib/types';
  import { nodeTypeLabel, t } from '$lib/i18n/index.svelte';

  let {
    node,
    type,
    media,
    anchor,
    open,
    keep,
    leave
  }: {
    node: WorldNode;
    type?: NodeType;
    media: MediaAsset[];
    anchor: { x: number; y: number };
    open: () => void;
    keep: () => void;
    leave: () => void;
  } = $props();

  let card: HTMLElement;
  let viewport = $state({ width: 1200, height: 800 });
  let cardHeight = $state(210);
  let image = $derived(media.find((item) => item.id === node.imageMediaId));
  let cardWidth = $derived(Math.min(316, viewport.width - 20));
  let left = $derived(Math.max(10, Math.min(anchor.x, viewport.width - cardWidth - 10)));
  let top = $derived(
    anchor.y + cardHeight > viewport.height - 10
      ? Math.max(10, anchor.y - cardHeight - 26)
      : anchor.y
  );

  onMount(() => {
    const measure = () => {
      viewport = { width: innerWidth, height: innerHeight };
      cardHeight = card?.offsetHeight || cardHeight;
    };
    const observer = new ResizeObserver(measure);
    observer.observe(card);
    addEventListener('resize', measure);
    measure();
    return () => {
      observer.disconnect();
      removeEventListener('resize', measure);
    };
  });
</script>

<div
  bind:this={card}
  class="node-preview"
  role="dialog"
  tabindex="-1"
  aria-label={t('graph.detailsFor', { title: node.title })}
  style:--node-color={type?.colorDark ?? 'var(--text-3)'}
  style:left={`${left}px`}
  style:top={`${top}px`}
  style:width={`${cardWidth}px`}
  onpointerenter={keep}
  onpointerleave={leave}
>
  {#if image}<img src={image.url} alt="" />{/if}
  <div class="meta">
    <i></i><span
      >{type ? nodeTypeLabel(type, 'singular') : node.type}{#if node.pinned}
        · {t('common.pinned')}{/if}</span
    >{#if !node.revealed}<em>✦ {t('common.secret')}</em>{/if}
  </div>
  <h3 class="serif-title">{node.title}</h3>
  <p class:empty={!node.summary}>{node.summary || t('graph.noSummary')}</p>
  {#if node.tags.length}<div class="tags">
      {#each node.tags as tag}<span>{tag}</span>{/each}
    </div>{/if}
  <div class="spacer"></div>
  <footer>
    <button onclick={open}><Icon name="open" size={14} />{t('common.open')}</button>
  </footer>
</div>

<style>
  .node-preview {
    position: fixed;
    z-index: 70;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid var(--line-2);
    border-radius: 14px;
    background: color-mix(in srgb, var(--bg-2) 96%, transparent);
    color: var(--text);
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(16px);
    animation: preview-in 0.13s ease;
  }
  img {
    width: 100%;
    height: 128px;
    display: block;
    object-fit: cover;
  }
  .meta {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 11px 12px 0;
  }
  .meta i {
    width: 9px;
    height: 9px;
    flex: 0 0 auto;
    border-radius: 50%;
    background: var(--node-color);
  }
  .meta span {
    min-width: 0;
    flex: 1;
    overflow: hidden;
    color: var(--text-3);
    font: 9.5px var(--font-mono);
    letter-spacing: 0.1em;
    text-overflow: ellipsis;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .meta em {
    color: var(--ember);
    font: 9px var(--font-mono);
    font-style: normal;
    white-space: nowrap;
  }
  h3 {
    margin: 5px 12px 0;
    font-size: 22px;
    font-weight: 400;
    line-height: 1.2;
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
  footer {
    display: flex;
    padding: 8px;
    border-top: 1px solid var(--line);
  }
  footer button {
    min-height: 36px;
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border: 0;
    border-radius: 9px;
    background: var(--ember);
    color: #1a1206;
    font-size: 12.5px;
    font-weight: 600;
  }
  @keyframes preview-in {
    from {
      opacity: 0;
      transform: translateY(3px);
    }
  }
</style>
