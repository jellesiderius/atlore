<script lang="ts">
  import Icon from '$lib/components/ui/Icon.svelte';
  import type { MenuItem } from '$lib/components/ui/ContextMenu.svelte';
  import { tooltip } from '$lib/actions/tooltip';
  import type { Campaign, MediaAsset, NodeType, WorldNode } from '$lib/types';
  import { t } from '$lib/i18n/index.svelte';
  let {
    campaign,
    nodes,
    types,
    media,
    canUpload,
    canPin,
    uploadMain,
    pinNode,
    openNode,
    previewNode,
    showNodeContext
  }: {
    campaign: Campaign;
    nodes: WorldNode[];
    types: NodeType[];
    media: MediaAsset[];
    canUpload: boolean;
    canPin: boolean;
    uploadMain: (file: File) => Promise<void>;
    pinNode: (id: string, value: Record<string, unknown>) => Promise<void>;
    openNode: (id: string) => void;
    previewNode: (id: string | null, x?: number, y?: number, delay?: number) => void;
    showNodeContext: (id: string, x: number, y: number, items?: MenuItem[]) => void;
  } = $props();
  let mapKey = $state<string>('campaign');
  let zoom = $state(1);
  let panX = $state(0);
  let panY = $state(0);
  let dragging = $state<{ x: number; y: number; panX: number; panY: number } | null>(null);
  let moving = $state<string | null>(null);
  let stage = $state<HTMLDivElement>();
  let busy = $state(false);
  let mapOwner = $derived(mapKey === 'campaign' ? null : nodes.find((node) => node.id === mapKey));
  let mediaId = $derived(mapKey === 'campaign' ? campaign.mapMediaId : mapOwner?.mapMediaId);
  let asset = $derived(media.find((item) => item.id === mediaId));
  let mapOptions = $derived([
    { id: 'campaign', title: campaign.title },
    ...nodes
      .filter((node) => node.mapMediaId && !node.trashedAt)
      .map((node) => ({ id: node.id, title: node.title }))
  ]);
  let markers = $derived(
    nodes.filter(
      (node) =>
        !node.trashedAt &&
        node.pinX !== null &&
        node.pinY !== null &&
        node.pinMapId === (mapKey === 'campaign' ? null : mapKey)
    )
  );
  let typeMap = $derived(new Map(types.map((type) => [type.key, type])));
  async function picked(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    busy = true;
    try {
      await uploadMain(file);
    } finally {
      busy = false;
    }
  }
  function wheel(event: WheelEvent) {
    event.preventDefault();
    zoom = Math.max(0.3, Math.min(5, zoom * Math.exp(-event.deltaY * 0.001)));
  }
  function down(event: PointerEvent) {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest('.marker')) return;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    dragging = { x: event.clientX, y: event.clientY, panX, panY };
  }
  function move(event: PointerEvent) {
    if (dragging) {
      panX = dragging.panX + event.clientX - dragging.x;
      panY = dragging.panY + event.clientY - dragging.y;
    }
    if (moving) {
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
      const node = nodes.find((item) => item.id === moving);
      if (node) {
        node.pinX = x;
        node.pinY = y;
      }
    }
  }
  async function up() {
    if (moving) {
      const node = nodes.find((item) => item.id === moving);
      if (node)
        await pinNode(node.id, {
          pinX: node.pinX,
          pinY: node.pinY,
          pinMapId: mapKey === 'campaign' ? null : mapKey
        });
      moving = null;
    }
    dragging = null;
  }
  async function drop(event: DragEvent) {
    event.preventDefault();
    if (!canPin || !asset) return;
    const id = event.dataTransfer?.getData('application/x-atlore-node');
    if (!id || !stage) return;
    const rect = stage.getBoundingClientRect();
    await pinNode(id, {
      pinX: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      pinY: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
      pinMapId: mapKey === 'campaign' ? null : mapKey
    });
  }
</script>

<section class="atlas">
  <header>
    <select
      bind:value={mapKey}
      onchange={() => {
        zoom = 1;
        panX = 0;
        panY = 0;
      }}
      >{#each mapOptions as option}<option value={option.id}>{option.title}</option>{/each}</select
    ><span></span><button
      onclick={() => {
        zoom = 1;
        panX = 0;
        panY = 0;
      }}
      aria-label={t('atlas.fit')}
      use:tooltip={t('atlas.fit')}><Icon name="fit" size={16} /></button
    >
    <div class="zoom">
      <button
        onclick={() => (zoom = Math.max(0.3, zoom - 0.2))}
        aria-label={t('atlas.zoomOut')}
        use:tooltip={t('atlas.zoomOut')}>−</button
      ><b>{Math.round(zoom * 100)}%</b><button
        onclick={() => (zoom = Math.min(5, zoom + 0.2))}
        aria-label={t('atlas.zoomIn')}
        use:tooltip={t('atlas.zoomIn')}>+</button
      >
    </div>
  </header>
  <div
    class="viewport"
    role="application"
    aria-label={t('atlas.ariaLabel')}
    onwheel={wheel}
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={up}
    ondragover={(event) => event.preventDefault()}
    ondrop={drop}
  >
    {#if asset}<div
        bind:this={stage}
        class="stage"
        style:transform={`translate(${panX}px,${panY}px) scale(${zoom})`}
      >
        <img
          src={asset.url}
          alt={t('atlas.mapOf', { title: mapOwner?.title ?? campaign.title })}
          draggable="false"
        />{#each markers as node}<button
            class="marker"
            class:locked={node.markerLocked}
            style:left={`${node.pinX! * 100}%`}
            style:top={`${node.pinY! * 100}%`}
            style:--marker-color={typeMap.get(node.type)?.colorDark}
            aria-label={node.title}
            onpointerenter={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              previewNode(node.id, rect.right + 8, rect.top - 4, 160);
            }}
            onpointerleave={() => previewNode(null)}
            onpointerdown={(event) => {
              event.stopPropagation();
              if (event.button !== 0) return;
              if (canPin && !node.markerLocked) moving = node.id;
            }}
            ondblclick={() => openNode(node.id)}
            oncontextmenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              moving = null;
              showNodeContext(
                node.id,
                event.clientX,
                event.clientY,
                canPin
                  ? [
                      {
                        label: node.markerLocked ? t('atlas.unlockMarker') : t('atlas.lockMarker'),
                        icon: node.markerLocked ? 'unlock' : 'lock',
                        run: () => pinNode(node.id, { markerLocked: !node.markerLocked })
                      },
                      {
                        label: t('atlas.removeMarker'),
                        icon: 'unpin',
                        danger: true,
                        run: () => pinNode(node.id, { pinX: null, pinY: null, pinMapId: null })
                      }
                    ]
                  : []
              );
            }}
            ><span><Icon name={node.markerLocked ? 'lock' : 'pin'} size={12} /></span><b
              >{node.title}</b
            ></button
          >{/each}
      </div>{:else}<div class="upload-empty">
        <Icon name="atlas" size={42} />
        <h2 class="serif-title">{t('atlas.emptyHeading')}</h2>
        <p>{t('atlas.emptyText')}</p>
        {#if canUpload}<label class="primary-button"
            >{busy ? t('common.upload') : t('atlas.upload')}<input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onchange={picked}
            /></label
          >{/if}
      </div>{/if}
  </div>
</section>

<style>
  .atlas {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: var(--canvas);
  }
  .atlas > header {
    height: 54px;
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 10px;
    border-bottom: 1px solid var(--line);
  }
  .atlas > header select {
    height: 36px;
    min-width: 220px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--bg-3);
    padding: 0 8px;
    font-size: 12px;
  }
  .atlas > header > span {
    flex: 1;
  }
  .atlas > header > button,
  .zoom button {
    width: 34px;
    height: 34px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: transparent;
    color: var(--text-3);
  }
  .zoom {
    display: flex;
    align-items: center;
  }
  .zoom b {
    min-width: 48px;
    text-align: center;
    font: 9px var(--font-mono);
    color: var(--text-3);
  }
  .viewport {
    position: relative;
    flex: 1;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    touch-action: none;
    background: radial-gradient(circle at 50% 50%, var(--bg-2), var(--canvas) 68%);
  }
  .stage {
    position: relative;
    max-width: 88%;
    max-height: 88%;
    transform-origin: center;
    transition: transform 0.04s linear;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }
  .stage > img {
    display: block;
    max-width: 100%;
    max-height: calc(100dvh - 160px);
    user-select: none;
  }
  .marker {
    position: absolute;
    transform: translate(-50%, -50%) scale(calc(1 / var(--map-zoom, 1)));
    display: flex;
    align-items: center;
    gap: 5px;
    border: 0;
    background: transparent;
    color: var(--text);
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.8));
  }
  .marker > span {
    width: 26px;
    height: 26px;
    display: grid;
    place-items: center;
    border: 2px solid color-mix(in srgb, var(--marker-color) 80%, white);
    border-radius: 50% 50% 50% 10%;
    transform: rotate(-45deg);
    background: var(--marker-color);
    color: #111;
  }
  .marker > span :global(svg) {
    transform: rotate(45deg);
  }
  .marker b {
    padding: 3px 5px;
    border-radius: 5px;
    background: rgba(10, 12, 16, 0.74);
    font-size: 11px;
    white-space: nowrap;
  }
  .marker.locked {
    opacity: 0.8;
  }
  .upload-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    color: var(--text-3);
  }
  .upload-empty h2 {
    margin: 12px 0 3px;
    color: var(--text);
    font-size: 29px;
    font-weight: 400;
  }
  .upload-empty p {
    margin: 0 0 16px;
  }
  .upload-empty label {
    display: grid;
    place-items: center;
    cursor: pointer;
  }
  .upload-empty input {
    display: none;
  }
  @media (max-width: 600px) {
    .atlas > header select {
      min-width: 0;
      flex: 1;
    }
    .atlas > header > span {
      display: none;
    }
    .stage {
      max-width: 98%;
    }
    .marker b {
      display: none;
    }
  }
</style>
