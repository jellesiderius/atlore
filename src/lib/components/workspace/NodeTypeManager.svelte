<script lang="ts">
  import type { NodeType } from '$lib/types';

  const swatches = [
    '#e57373',
    '#f0913f',
    '#e7c65b',
    '#79bf82',
    '#63b7a6',
    '#59a8d8',
    '#6f8fe8',
    '#9878d8',
    '#c776c8',
    '#d9789a',
    '#a68d72',
    '#8e99a9'
  ];

  let {
    types,
    canManage,
    add,
    remove
  }: {
    types: NodeType[];
    canManage: boolean;
    add: (value: {
      key: string;
      pluralName: string;
      singularName: string;
      colorDark: string;
      colorLight: string;
    }) => Promise<void>;
    remove: (key: string) => Promise<void>;
  } = $props();

  let expanded = $state(false);
  let singularName = $state('');
  let pluralName = $state('');
  let color = $state(swatches[1]);
  let busy = $state(false);
  let message = $state('');

  function slug(value: string) {
    return value
      .toLocaleLowerCase('nl')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 40);
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const key = slug(singularName);
    if (!key) return;
    busy = true;
    message = '';
    try {
      await add({
        key,
        singularName,
        pluralName: pluralName || `${singularName}s`,
        colorDark: color,
        colorLight: color
      });
      singularName = '';
      pluralName = '';
      expanded = false;
    } catch (cause) {
      message = cause instanceof Error ? cause.message : 'Type toevoegen is mislukt.';
    } finally {
      busy = false;
    }
  }
</script>

<div class="type-heading">
  <div class="eyebrow">Nodetypes · {types.filter((type) => type.key !== 'session').length}</div>
  {#if canManage}<button onclick={() => (expanded = !expanded)}
      >{expanded ? 'Sluiten' : '+ Eigen type'}</button
    >{/if}
</div>

<div class="type-list">
  {#each types.filter((type) => type.key !== 'session') as type}
    <div>
      <span style:background={type.colorDark}></span><b>{type.nl}</b><small>{type.one}</small>
      {#if type.custom && canManage}
        <button
          aria-label={`${type.nl} verwijderen`}
          onclick={() => confirm(`Type ${type.nl} verwijderen?`) && remove(type.key)}>×</button
        >
      {/if}
    </div>
  {/each}
</div>

{#if expanded}
  <form onsubmit={submit}>
    <input
      class="field"
      bind:value={singularName}
      placeholder="Enkelvoud, bv. Schip"
      required
      maxlength="50"
    />
    <input
      class="field"
      bind:value={pluralName}
      placeholder="Meervoud, bv. Schepen"
      maxlength="50"
    />
    <div class="swatches">
      {#each swatches as swatch}
        <button
          type="button"
          class:active={color === swatch}
          style:background={swatch}
          aria-label={`Kleur ${swatch}`}
          onclick={() => (color = swatch)}
        ></button>
      {/each}
    </div>
    <button class="primary-button" disabled={busy}>{busy ? 'Toevoegen…' : 'Type toevoegen'}</button>
    {#if message}<p role="alert">{message}</p>{/if}
  </form>
{/if}

<style>
  .type-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 18px 4px 8px;
  }
  .type-heading button {
    border: 0;
    background: transparent;
    color: var(--ember);
    font-size: 11px;
  }
  .type-list {
    max-height: 180px;
    overflow-y: auto;
  }
  .type-list > div {
    min-height: 29px;
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 0 7px;
    border-radius: 7px;
    color: var(--text-2);
  }
  .type-list > div:hover {
    background: var(--bg-3);
  }
  .type-list span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }
  .type-list b {
    flex: 1;
    font-size: 11.5px;
    font-weight: 400;
  }
  .type-list small {
    color: var(--text-3);
    font: 8.5px var(--font-mono);
  }
  .type-list button {
    border: 0;
    background: transparent;
    color: var(--text-3);
    font-size: 16px;
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 9px;
    padding: 9px;
    border: 1px solid var(--line);
    border-radius: 9px;
    background: var(--bg-2);
  }
  form .field {
    min-height: 34px;
    font-size: 11.5px;
  }
  .swatches {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 5px;
  }
  .swatches button {
    height: 22px;
    border: 2px solid transparent;
    border-radius: 6px;
  }
  .swatches button.active {
    border-color: white;
    box-shadow: 0 0 0 1px var(--ember);
  }
  form p {
    margin: 0;
    color: var(--danger);
    font-size: 11px;
  }
</style>
