<script lang="ts">
  import { goto } from '$app/navigation';
  import AuthFormMessage from '$lib/components/auth/AuthFormMessage.svelte';
  import AuthShell from '$lib/components/auth/AuthShell.svelte';
  import { api } from '$lib/client/api';
  import { t } from '$lib/i18n/index.svelte';
  let { data }: { data: { token: string } } = $props();
  let password = $state('');
  let repeat = $state('');
  let busy = $state(false);
  let message = $state('');
  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (password !== repeat) {
      message = t('auth.reset.mismatch');
      return;
    }
    busy = true;
    message = '';
    try {
      await api('/api/auth/reset', {
        method: 'POST',
        body: JSON.stringify({ token: data.token, password })
      });
      await goto('/campaigns', { invalidateAll: true });
    } catch (cause) {
      message = cause instanceof Error ? cause.message : t('auth.reset.failed');
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>{t('auth.reset.title')} · Atlore</title></svelte:head>
<AuthShell heading={t('auth.reset.heading')} subheading={t('auth.reset.subheading')}>
  <form onsubmit={submit}>
    <input
      class="field"
      aria-label={t('auth.reset.newPassword')}
      type="password"
      autocomplete="new-password"
      minlength="10"
      placeholder={t('auth.reset.newPassword')}
      bind:value={password}
      required
    />
    <input
      class="field"
      aria-label={t('auth.reset.repeatPassword')}
      type="password"
      autocomplete="new-password"
      minlength="10"
      placeholder={t('auth.reset.repeatPassword')}
      bind:value={repeat}
      required
    />
    {#if message}<AuthFormMessage {message} />{/if}<button
      class="primary-button submit"
      disabled={busy}>{busy ? t('common.saving') : t('auth.reset.submit')}</button
    >
  </form>
</AuthShell>

<style>
  .field {
    margin-bottom: 8px;
    min-height: 46px;
  }
  .submit {
    width: 100%;
    min-height: 46px;
  }
</style>
