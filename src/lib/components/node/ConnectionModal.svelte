<script lang="ts">
  import { onMount } from 'svelte';
  import Modal from '$lib/components/ui/Modal.svelte';
  import { searchNodes } from '$lib/domain/search';
  import type { NodeType, WorldLink, WorldNode } from '$lib/types';
  let {
    node,
    nodes,
    links,
    types,
    close,
    connect
  }: {
    node: WorldNode;
    nodes: WorldNode[];
    links: WorldLink[];
    types: NodeType[];
    close: () => void;
    connect: (id: string) => Promise<void>;
  } = $props();
  let query = $state('');
  let searchInput = $state<HTMLInputElement>();
  let busy = $state<string | null>(null);
  let connected = $derived(
    new Set(
      links.flatMap((link) =>
        link.sourceId === node.id
          ? [link.targetId]
          : link.targetId === node.id
            ? [link.sourceId]
            : []
      )
    )
  );
  let results = $derived(
    searchNodes(nodes, query, { limit: 8, exclude: new Set([node.id, ...connected]) })
  );
  onMount(() => searchInput?.focus());
</script>

<Modal title={`Verbinden met ${node.title}`} eyebrow="Koppelingen leggen" {close}
  ><input bind:this={searchInput} class="field" bind:value={query} placeholder="Zoek nodes…" />
  <div class="connected">
    {#each [...connected]
      .map((id) => nodes.find((item) => item.id === id))
      .filter(Boolean) as item}<span
        style:--color={types.find((type) => type.key === item!.type)?.colorDark}
        ><i></i>{item!.title}</span
      >{/each}
  </div>
  <div class="results">
    {#each results as result}<button
        disabled={busy === result.id}
        onclick={async () => {
          busy = result.id;
          await connect(result.id);
          busy = null;
          query = '';
        }}
        ><span style:background={types.find((type) => type.key === result.type)?.colorDark}
        ></span><b>{result.title}</b><small
          >{types.find((type) => type.key === result.type)?.one}</small
        ><em>{busy === result.id ? '…' : '+'}</em></button
      >{/each}{#if query && !results.length}<p>Geen andere nodes gevonden.</p>{/if}
  </div>
  <p class="hint">Blijf nodes aantikken; dit venster blijft open.</p></Modal
>

<style>
  .connected {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin: 8px 0;
  }
  .connected span {
    min-height: 27px;
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 0 8px;
    border-radius: 7px;
    background: var(--bg-3);
    color: var(--text-2);
    font-size: 11px;
  }
  .connected i {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color);
  }
  .results {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 310px;
    overflow-y: auto;
  }
  .results button {
    min-height: 36px;
    display: flex;
    align-items: center;
    gap: 8px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--text-2);
    text-align: left;
  }
  .results button:hover {
    background: var(--bg-3);
  }
  .results button > span {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }
  .results b {
    flex: 1;
    font-size: 12.5px;
    font-weight: 500;
  }
  .results small {
    font: 9px var(--font-mono);
    color: var(--text-3);
  }
  .results em {
    color: var(--ember);
    font-style: normal;
  }
  .results p,
  .hint {
    font-size: 11.5px;
    color: var(--text-3);
  }
  .hint {
    margin: 12px 0 0;
  }
</style>
