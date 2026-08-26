<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import AuthFormMessage from '$lib/components/auth/AuthFormMessage.svelte';
  import AuthShell from '$lib/components/auth/AuthShell.svelte';
  import { api } from '$lib/client/api';
  import { t } from '$lib/i18n/index.svelte';
  let name = $state('');
  let email = $state('');
  let password = $state('');
  let busy = $state(false);
  let message = $state('');
  async function submit(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    message = '';
    try {
      await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password })
      });
      const next = page.url.searchParams.get('next');
      await goto(next?.startsWith('/') ? next : '/campaigns', { invalidateAll: true });
    } catch (cause) {
      message = cause instanceof Error ? cause.message : t('auth.register.failed');
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>{t('auth.register.title')} · Atlore</title></svelte:head>
<AuthShell heading={t('auth.register.heading')} subheading={t('auth.register.subheading')}>
  <form onsubmit={submit}>
    <input
      class="field"
      aria-label={t('auth.register.name')}
      autocomplete="name"
      placeholder={t('auth.register.namePlaceholder')}
      bind:value={name}
      required
    />
    <input
      class="field"
      aria-label={t('auth.email')}
      type="email"
      autocomplete="email"
      placeholder={t('auth.email')}
      bind:value={email}
      required
    />
    <input
      class="field"
      aria-label={t('auth.password')}
      type="password"
      autocomplete="new-password"
      placeholder={t('auth.register.passwordPlaceholder')}
      minlength="10"
      bind:value={password}
      required
    />
    {#if message}<AuthFormMessage {message} />{/if}
    <button class="primary-button submit" disabled={busy}
      >{busy ? t('auth.wait') : t('auth.register.submit')}</button
    >
    <p>{t('auth.register.existing')} <a href="/auth/login">{t('auth.login.submit')}</a></p>
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
  p {
    text-align: center;
    color: var(--text-3);
    font-size: 12.5px;
    margin: 14px 0 0;
  }
</style>
