<script lang="ts">
  import { t } from '$lib/i18n/index.svelte';

  export interface Toast {
    id: string;
    text: string;
    action?: { label: string; run: () => void };
  }
  let { toasts, dismiss }: { toasts: Toast[]; dismiss: (id: string) => void } = $props();
</script>

<div class="toasts" aria-live="polite">
  {#each toasts as toast (toast.id)}<div>
      <span>{toast.text}</span>{#if toast.action}<button
          onclick={() => {
            toast.action!.run();
            dismiss(toast.id);
          }}>{toast.action.label}</button
        >{/if}<button class="close" aria-label={t('common.close')} onclick={() => dismiss(toast.id)}
        >×</button
      >
    </div>{/each}
</div>

<style>
  .toasts {
    position: fixed;
    z-index: 150;
    left: 50%;
    bottom: max(18px, env(safe-area-inset-bottom));
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    pointer-events: none;
  }
  .toasts > div {
    min-width: 250px;
    max-width: min(430px, calc(100vw - 24px));
    min-height: 42px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 7px 6px 13px;
    border: 1px solid var(--line-2);
    border-radius: 10px;
    background: var(--bg-2);
    box-shadow: 0 12px 35px rgba(0, 0, 0, 0.48);
    font-size: 12.5px;
    animation: lift-in 0.18s var(--ease-atlore);
    pointer-events: auto;
  }
  .toasts span {
    flex: 1;
  }
  .toasts button {
    border: 0;
    background: transparent;
    color: var(--ember);
    font-size: 11.5px;
  }
  .toasts .close {
    width: 28px;
    height: 28px;
    color: var(--text-3);
    font-size: 16px;
  }
  @media (max-width: 859px) {
    .toasts {
      bottom: calc(70px + env(safe-area-inset-bottom));
    }
  }
</style>
