<script lang="ts">
  import { i18n, setLocale, t, type Locale } from '$lib/i18n/index.svelte';

  let { compact = false }: { compact?: boolean } = $props();
</script>

<label class:compact>
  <span>{t('language.label')}</span>
  <select
    aria-label={t('language.label')}
    value={i18n.locale}
    onchange={(event) => setLocale(event.currentTarget.value as Locale)}
  >
    <option value="nl">NL</option>
    <option value="en">EN</option>
  </select>
</label>

<style>
  label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--muted);
    font: 500 10px/1 var(--mono);
    letter-spacing: 0.13em;
    text-transform: uppercase;
  }
  select {
    min-width: 66px;
    height: 34px;
    padding: 0 26px 0 10px;
    border: 1px solid var(--line);
    border-radius: 9px;
    background: var(--panel);
    color: var(--text);
    font: 500 11px/1 var(--mono);
    cursor: pointer;
  }
  .compact span {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
  .compact select {
    min-width: 56px;
    height: 32px;
  }
</style>
