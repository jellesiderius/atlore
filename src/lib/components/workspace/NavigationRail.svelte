<script lang="ts">
  import Icon from '$lib/components/ui/Icon.svelte';
  import { tooltip } from '$lib/actions/tooltip';
  import type { ViewName } from '$lib/types';
  import { t } from '$lib/i18n/index.svelte';
  let { view, pick }: { view: ViewName; pick: (view: ViewName) => void } = $props();
  const items: { key: ViewName; labelKey: string; icon: string }[] = [
    { key: 'graph', labelKey: 'navigation.graph', icon: 'graph' },
    { key: 'session', labelKey: 'navigation.session', icon: 'session' },
    { key: 'story', labelKey: 'navigation.story', icon: 'story' },
    { key: 'atlas', labelKey: 'navigation.atlas', icon: 'atlas' }
  ];
</script>

<nav aria-label={t('navigation.label')}>
  {#each items as item}<button
      class:active={view === item.key}
      aria-label={t(item.labelKey)}
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
      height: calc(58px + env(safe-area-inset-bottom));
      padding: 4px 8px env(safe-area-inset-bottom);
      border: 0;
      border-top: 1px solid var(--line);
      flex-direction: row;
      justify-content: space-around;
      background: var(--bg-2);
    }
    button {
      width: auto;
      height: 48px;
      min-width: 58px;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    button span {
      display: block;
      font: 8.5px var(--font-mono);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
  }
</style>
