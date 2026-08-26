<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import AuthFormMessage from '$lib/components/auth/AuthFormMessage.svelte';
  import AuthShell from '$lib/components/auth/AuthShell.svelte';
  import { api } from '$lib/client/api';
  import { t } from '$lib/i18n/index.svelte';

  let email = $state('');
  let password = $state('');
  let busy = $state(false);
  let message = $state('');

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    message = '';
    try {
      await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      const next = page.url.searchParams.get('next');
      await goto(next?.startsWith('/') ? next : '/campaigns', { invalidateAll: true });
    } catch (cause) {
      message = cause instanceof Error ? cause.message : t('auth.login.failed');
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>{t('auth.login.title')} · Atlore</title></svelte:head>

<AuthShell heading={t('auth.login.heading')} subheading={t('auth.login.subheading')}>
  <form onsubmit={submit}>
    <label class="screen-reader-only" for="email">{t('auth.email')}</label>
    <input
      class="field"
      id="email"
      type="email"
      autocomplete="email"
      placeholder={t('auth.email')}
      bind:value={email}
      required
    />
    <label class="screen-reader-only" for="password">{t('auth.password')}</label>
    <input
      class="field"
      id="password"
      type="password"
      autocomplete="current-password"
      placeholder={t('auth.password')}
      bind:value={password}
      required
    />
    {#if message}<AuthFormMessage {message} />{/if}
    <button class="primary-button submit" disabled={busy}
      >{busy ? t('auth.wait') : t('auth.login.submit')}</button
    >
    <div class="links">
      <a href="/auth/forgot">{t('auth.login.forgot')}</a><span
        >{t('auth.login.noAccount')} <a href="/auth/register">{t('auth.login.register')}</a></span
      >
    </div>
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
    margin-top: 4px;
  }
  .links {
    display: flex;
    justify-content: space-between;
    gap: 14px;
    margin-top: 14px;
    font-size: 12.5px;
    color: var(--text-3);
  }
  .links a:first-child {
    color: var(--text-3);
  }
  .links span a {
    margin-left: 4px;
  }
  @media (max-width: 390px) {
    .links {
      flex-direction: column;
      align-items: center;
    }
  }
</style>
