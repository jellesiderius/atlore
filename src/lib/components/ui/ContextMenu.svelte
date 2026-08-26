<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from './Icon.svelte';
  export interface MenuItem {
    label: string;
    icon: string;
    danger?: boolean;
    run: () => void;
  }
  let { x, y, items, close }: { x: number; y: number; items: MenuItem[]; close: () => void } =
    $props();
  onMount(() => {
    const listener = () => close();
    setTimeout(() => document.addEventListener('pointerdown', listener), 0);
    return () => document.removeEventListener('pointerdown', listener);
  });
</script>

<div
  class="menu"
  style:left={`${Math.min(x, innerWidth - 230)}px`}
  style:top={`${Math.min(y, innerHeight - items.length * 38 - 20)}px`}
  role="menu"
  tabindex="-1"
  oncontextmenu={(event) => event.preventDefault()}
>
  {#each items as item}<button
      class:danger={item.danger}
      onclick={() => {
        item.run();
        close();
      }}><Icon name={item.icon} size={15} /><span>{item.label}</span></button
    >{/each}
</div>

<style>
  .menu {
    position: fixed;
    z-index: 110;
    width: 220px;
    padding: 5px;
    border: 1px solid var(--line-2);
    border-radius: 10px;
    background: var(--bg-2);
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.55);
    animation: fade-in 0.1s ease;
  }
  .menu button {
    width: 100%;
    min-height: 34px;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 0 9px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: var(--text-2);
    font-size: 12.5px;
    text-align: left;
  }
  .menu button:hover {
    background: var(--bg-3);
    color: var(--text);
  }
  .menu .danger {
    color: var(--danger);
    border-top: 1px solid var(--line);
    border-radius: 0 0 7px 7px;
    margin-top: 3px;
  }
</style>
