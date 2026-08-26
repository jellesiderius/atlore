<script lang="ts">
  import NodeChip from './NodeChip.svelte';
  import RemoteCursors, { type RemoteCursor } from './RemoteCursors.svelte';
  import TextSurface from './TextSurface.svelte';
  import type { NodeType, Paragraph, WorldNode } from '$lib/types';
  import { t } from '$lib/i18n/index.svelte';
  let {
    body,
    nodes,
    types,
    openNode,
    previewNode,
    remoteCursors = [],
    surface = 'default',
    surfaceLabel = ''
  }: {
    body: Paragraph[];
    nodes: WorldNode[];
    types: NodeType[];
    openNode?: (id: string) => void;
    previewNode?: (id: string | null, x?: number, y?: number, delay?: number) => void;
    remoteCursors?: RemoteCursor[];
    surface?: 'default' | 'compact' | 'plain';
    surfaceLabel?: string;
  } = $props();
  let byId = $derived(new Map(nodes.map((node) => [node.id, node])));
  let typeByKey = $derived(new Map(types.map((type) => [type.key, type])));
  let viewShell = $state<HTMLDivElement>(undefined!);
  let richView = $state<HTMLDivElement>(undefined!);
</script>

{#snippet content()}
  <div class="rich-view-shell" bind:this={viewShell}>
    <div class="rich-view" bind:this={richView}>
      {#each body as paragraph}<p>
          {#each paragraph.segs as segment}{#if segment.t === 'txt'}{segment.v}{:else}{#if byId.get(segment.id)}<NodeChip
                  node={byId.get(segment.id)}
                  type={typeByKey.get(byId.get(segment.id)!.type)}
                  {previewNode}
                  onclick={() => openNode?.(segment.id)}
                />{:else}<NodeChip secret onclick={() => {}} />{/if}{/if}{/each}
        </p>{/each}
    </div>
    <RemoteCursors host={viewShell} content={richView} cursors={remoteCursors} />
  </div>
{/snippet}

{#if surface === 'plain'}
  {@render content()}
{:else}
  <TextSurface
    mode="read"
    label={surfaceLabel || t('editor.readSurface')}
    compact={surface === 'compact'}
  >
    {@render content()}
  </TextSurface>
{/if}

<style>
  .rich-view-shell {
    position: relative;
  }
  .rich-view {
    font-size: 15px;
    line-height: 1.74;
    color: var(--text);
    user-select: text;
    -webkit-user-select: text;
  }
  .rich-view p {
    margin: 0 0 1.05em;
    white-space: pre-wrap;
  }
  .rich-view p:last-child {
    margin-bottom: 0;
  }
</style>
