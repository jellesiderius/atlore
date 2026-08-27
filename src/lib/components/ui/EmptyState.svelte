<script lang="ts">
  import Icon from '$lib/components/ui/Icon.svelte';

  let {
    icon,
    heading,
    text,
    actionLabel = '',
    action,
    compact = false,
    testId = ''
  }: {
    icon: string;
    heading: string;
    text: string;
    actionLabel?: string;
    action?: () => void;
    compact?: boolean;
    testId?: string;
  } = $props();
</script>

<section class="empty-state" class:compact data-testid={testId || undefined}>
  <span class="mark" aria-hidden="true"><Icon name={icon} size={compact ? 30 : 42} /></span>
  <h2 class="serif-title">{heading}</h2>
  <p>{text}</p>
  {#if action && actionLabel}<button
      type="button"
      class="primary-button"
      onclick={action}
      data-testid={testId ? `${testId}-action` : undefined}>{actionLabel}</button
    >{/if}
</section>

<style>
  .empty-state {
    width: min(390px, calc(100% - 36px));
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    color: var(--text-3);
  }
  .mark {
    display: grid;
    place-items: center;
  }
  h2 {
    margin: 12px 0 3px;
    color: var(--text);
    font-size: 29px;
    font-weight: 400;
    line-height: 1.1;
  }
  p {
    max-width: 310px;
    margin: 0 0 16px;
    color: var(--text-2);
    line-height: 1.65;
  }
  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .compact {
    width: 100%;
    padding: 20px;
  }
  .compact .mark {
    color: var(--text-3);
  }
  .compact h2 {
    margin-top: 10px;
    font-size: 24px;
  }
  .compact p {
    margin-bottom: 14px;
    font-size: 12px;
  }
  .compact button {
    min-height: 34px;
  }
  @media (max-width: 600px) {
    h2 {
      font-size: 27px;
    }
    .compact {
      padding: 20px 15px 22px;
    }
  }
</style>
