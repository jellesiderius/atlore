<script lang="ts">
  import AuthFormMessage from '$lib/components/auth/AuthFormMessage.svelte';
  import AuthShell from '$lib/components/auth/AuthShell.svelte';
  import { api } from '$lib/client/api';
  import { t } from '$lib/i18n/index.svelte';
  let email = $state('');
  let busy = $state(false);
  let message = $state('');
  let sent = $state(false);
  async function submit(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    message = '';
    try {
      const result = await api<{ message: string }>('/api/auth/forgot', {
        method: 'POST',
        body: JSON.stringify({ email })
      });
      message = result.message;
      sent = true;
    } catch (cause) {
      message = cause instanceof Error ? cause.message : t('auth.forgot.failed');
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>{t('auth.forgot.title')} · Atlore</title></svelte:head>
<AuthShell heading={t('auth.forgot.heading')} subheading={t('auth.forgot.subheading')}>
  <form onsubmit={submit}>
    <input
      class="field"
      aria-label={t('auth.email')}
      type="email"
      autocomplete="email"
      placeholder={t('auth.email')}
      bind:value={email}
      required
    />
    {#if message}<AuthFormMessage {message} kind={sent ? 'success' : 'error'} />{/if}
    <button class="primary-button submit" disabled={busy || sent}
      >{busy
        ? t('auth.forgot.sending')
        : sent
          ? t('auth.forgot.sent')
          : t('auth.forgot.submit')}</button
    >
    <p><a href="/auth/login">‹ {t('auth.forgot.back')}</a></p>
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
  p {
    text-align: center;
    font-size: 12.5px;
    margin: 14px 0 0;
  }
  p a {
    color: var(--text-3);
  }
</style>
