<script lang="ts">
  import Icon from '$lib/components/ui/Icon.svelte';

  let {
    mode,
    label,
    compact = false,
    hint = '',
    status = '',
    statusTone = 'neutral',
    children
  }: {
    mode: 'write' | 'read';
    label: string;
    compact?: boolean;
    hint?: string;
    status?: string;
    statusTone?: 'neutral' | 'saving' | 'saved' | 'error' | 'live';
    children: import('svelte').Snippet;
  } = $props();
</script>

<section
  class="text-surface"
  class:write={mode === 'write'}
  class:read={mode === 'read'}
  class:compact
  aria-label={label}
>
  <div class="mode-bar">
    <span aria-hidden="true"><Icon name={mode === 'write' ? 'edit' : 'eye'} size={12} /></span>
    <b>{label}</b>
    <i></i>
    {#if hint}<small class="hint" title={hint} data-testid="mention-hint">{hint}</small>{/if}
    {#if status}<small role="status" aria-live="polite" data-tone={statusTone}>{status}</small>{/if}
  </div>
  <div class="surface-content">{@render children()}</div>
</section>

<style>
  .text-surface {
    --surface-accent: var(--text-3);
    position: relative;
    overflow: visible;
    border: 1px solid var(--line-2);
    border-radius: 13px;
    background: color-mix(in srgb, var(--bg-2) 88%, transparent);
    box-shadow:
      0 8px 28px rgba(0, 0, 0, 0.12),
      inset 0 1px rgba(255, 255, 255, 0.015);
    transition:
      border-color 0.16s ease,
      box-shadow 0.16s ease,
      background 0.16s ease;
  }
  .text-surface.write {
    --surface-accent: var(--ember);
    border-color: color-mix(in srgb, var(--line-2) 76%, var(--ember));
    background:
      linear-gradient(180deg, color-mix(in srgb, var(--ember) 3.5%, transparent), transparent 70px),
      color-mix(in srgb, var(--bg-2) 92%, transparent);
  }
  .text-surface.write:focus-within {
    border-color: color-mix(in srgb, var(--ember) 72%, var(--line-2));
    background:
      linear-gradient(180deg, color-mix(in srgb, var(--ember) 5%, transparent), transparent 84px),
      var(--bg-2);
    box-shadow:
      0 0 0 3px var(--ember-soft),
      0 12px 34px rgba(0, 0, 0, 0.18);
  }
  .text-surface.read {
    --surface-accent: color-mix(in srgb, var(--text-2) 70%, var(--ember));
    border-color: var(--line);
    background: color-mix(in srgb, var(--canvas) 72%, var(--bg-2));
    box-shadow: inset 0 1px rgba(255, 255, 255, 0.012);
  }
  .mode-bar {
    min-height: 31px;
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 0 13px;
    border-bottom: 1px solid color-mix(in srgb, var(--line) 84%, transparent);
    color: var(--surface-accent);
    background: color-mix(in srgb, var(--bg-3) 44%, transparent);
  }
  .mode-bar > span {
    width: 19px;
    height: 19px;
    display: grid;
    place-items: center;
    border-radius: 5px;
    background: color-mix(in srgb, var(--surface-accent) 11%, transparent);
  }
  .mode-bar b {
    font: 8.5px var(--font-mono);
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .mode-bar i {
    flex: 1;
    height: 1px;
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--surface-accent) 20%, transparent),
      transparent
    );
  }
  .mode-bar small {
    flex: 0 0 auto;
    color: var(--text-3);
    font: 9px var(--font-mono);
    letter-spacing: 0.02em;
    white-space: nowrap;
  }
  .mode-bar small.hint {
    min-width: 0;
    flex: 0 1 auto;
    overflow: hidden;
    color: color-mix(in srgb, var(--text-3) 78%, var(--ember));
    text-overflow: ellipsis;
  }
  .mode-bar small[data-tone='saving'],
  .mode-bar small[data-tone='live'] {
    color: var(--surface-accent);
  }
  .mode-bar small[data-tone='error'] {
    color: var(--danger);
  }
  .surface-content {
    padding: 15px 17px 17px;
    color: var(--text);
  }
  .compact {
    border-radius: 10px;
    box-shadow: none;
  }
  .compact .mode-bar {
    min-height: 27px;
    padding: 0 10px;
  }
  .compact .mode-bar > span {
    width: 17px;
    height: 17px;
  }
  .compact .surface-content {
    padding: 10px 12px 12px;
  }
  @media (max-width: 600px) {
    .surface-content {
      padding: 13px 14px 15px;
    }
  }
</style>
