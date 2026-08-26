<script lang="ts">
  import NodeChip from './NodeChip.svelte';
  import type { NodeType, Paragraph, WorldNode } from '$lib/types';
  let {
    body,
    nodes,
    types,
    openNode
  }: { body: Paragraph[]; nodes: WorldNode[]; types: NodeType[]; openNode?: (id: string) => void } =
    $props();
  let byId = $derived(new Map(nodes.map((node) => [node.id, node])));
  let typeByKey = $derived(new Map(types.map((type) => [type.key, type])));
</script>

<div class="rich-view">
  {#each body as paragraph}<p>
      {#each paragraph.segs as segment}{#if segment.t === 'txt'}{segment.v}{:else}{#if byId.get(segment.id)}<NodeChip
              node={byId.get(segment.id)}
              type={typeByKey.get(byId.get(segment.id)!.type)}
              onclick={() => openNode?.(segment.id)}
            />{:else}<NodeChip secret onclick={() => {}} />{/if}{/if}{/each}
    </p>{/each}
</div>

<style>
  .rich-view {
    font-size: 15px;
    line-height: 1.74;
    color: var(--text-2);
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
