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
  let menu = $state<HTMLDivElement>();
  let left = $state(0);
  let top = $state(0);

  onMount(() => {
    const place = () => {
      if (!menu) return;
      const bounds = menu.getBoundingClientRect();
      left = Math.max(8, Math.min(x, innerWidth - bounds.width - 8));
      top = Math.max(8, Math.min(y, innerHeight - bounds.height - 8));
    };
    const outside = (event: PointerEvent) => {
      if (menu && !menu.contains(event.target as Node)) close();
    };
    const keyboard = (event: KeyboardEvent) => {
      if (!menu) return;
      const buttons = [...menu.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        buttons[(current + delta + buttons.length) % buttons.length]?.focus();
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        buttons[event.key === 'Home' ? 0 : buttons.length - 1]?.focus();
      }
    };
    place();
    menu?.querySelector<HTMLButtonElement>('button')?.focus();
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', keyboard);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', keyboard);
      window.removeEventListener('resize', place);
    };
  });
</script>

<div
  bind:this={menu}
  class="menu"
  style:left={`${left}px`}
  style:top={`${top}px`}
  role="menu"
  tabindex="-1"
  oncontextmenu={(event) => event.preventDefault()}
>
  {#each items as item}<button
      type="button"
      role="menuitem"
      class:danger={item.danger}
      onclick={async () => {
        close();
        await item.run();
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
