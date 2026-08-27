<script lang="ts">
  import Icon from '$lib/components/ui/Icon.svelte';
  import { tooltip } from '$lib/actions/tooltip';
  import type { ViewName } from '$lib/types';
  import { t } from '$lib/i18n/index.svelte';
  let { view, pick }: { view: ViewName; pick: (view: ViewName) => void } = $props();
  const items: { key: ViewName; labelKey: string; icon: string }[] = [
    { key: 'graph', labelKey: 'navigation.graph', icon: 'graph' },
    { key: 'session', labelKey: 'navigation.session', icon: 'session' },
    { key: 'atlas', labelKey: 'navigation.atlas', icon: 'atlas' }
  ];
</script>

<nav aria-label={t('navigation.label')}>
  {#each items as item}<button
      class:active={view === item.key}
      aria-label={t(item.labelKey)}
      aria-current={view === item.key ? 'page' : undefined}
      use:tooltip={t(item.labelKey)}
      onclick={() => pick(item.key)}
      ><Icon name={item.icon} size={17} /><span>{t(item.labelKey)}</span></button
    >{/each}
</nav>

<style>
  nav {
    width: 52px;
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px 0;
    border-right: 1px solid var(--line);
    background: var(--canvas);
    z-index: 30;
  }
  button {
    width: 38px;
    height: 38px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: var(--text-3);
  }
  button.active {
    background: var(--bg-3);
    color: var(--ember);
  }
  button:hover {
    color: var(--text);
  }
  button span {
    display: none;
  }
  @media (max-width: 859px) {
    nav {
      position: fixed;
      z-index: 55;
      left: 0;
      right: 0;
      bottom: 0;
      width: auto;
      height: calc(var(--mobile-navigation-height, 54px) + env(safe-area-inset-bottom));
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 4px;
      padding: 5px max(6px, env(safe-area-inset-right)) calc(5px + env(safe-area-inset-bottom))
        max(6px, env(safe-area-inset-left));
      border: 0;
      border-top: 1px solid var(--line);
      background: color-mix(in srgb, var(--bg-2) 94%, transparent);
      box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.16);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
    }
    button {
      position: relative;
      width: 100%;
      height: 44px;
      min-width: 0;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
      gap: 6px;
      border-radius: 10px;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }
    button.active {
      background: color-mix(in srgb, var(--ember) 10%, var(--bg-3));
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ember) 18%, transparent);
    }
    button :global(svg) {
      width: 18px;
      height: 18px;
      flex: 0 0 auto;
    }
    button span {
      display: block;
      min-width: 0;
      overflow: hidden;
      font: 9px var(--font-mono);
      text-transform: uppercase;
      letter-spacing: 0.045em;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
</style>
