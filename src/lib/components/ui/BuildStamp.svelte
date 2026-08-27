<script lang="ts">
  import ChangelogModal from '$lib/components/ui/ChangelogModal.svelte';
  import { t } from '$lib/i18n/index.svelte';

  let open = $state(false);
</script>

<button
  type="button"
  class="build-stamp"
  data-testid="build-stamp"
  title={t('changelog.open', { build: __ATLORE_BUILD__ })}
  aria-label={t('changelog.open', { build: __ATLORE_BUILD__ })}
  onclick={() => (open = true)}>{__ATLORE_BUILD__}</button
>
{#if open}<ChangelogModal close={() => (open = false)} />{/if}

<style>
  .build-stamp {
    position: absolute;
    z-index: 2;
    left: 50%;
    bottom: max(9px, env(safe-area-inset-bottom));
    transform: translateX(-50%);
    padding: 2px 4px;
    border: 0;
    border-bottom: 1px dotted transparent;
    background: transparent;
    color: var(--text-3);
    font: 9px var(--font-mono);
    letter-spacing: 0.08em;
    opacity: 0.68;
    white-space: nowrap;
  }
  .build-stamp:hover,
  .build-stamp:focus-visible {
    border-bottom-color: currentColor;
    color: var(--ember);
    opacity: 1;
  }
</style>
