<script lang="ts">
  import { goto } from '$app/navigation';
  import AuthShell from '$lib/components/auth/AuthShell.svelte';
  import AuthFormMessage from '$lib/components/auth/AuthFormMessage.svelte';
  import { api } from '$lib/client/api';
  import { t } from '$lib/i18n/index.svelte';
  let { data }: { data: { token: string; user: { name: string } | null } } = $props();
  let busy = $state(false);
  let message = $state('');
  async function accept() {
    busy = true;
    message = '';
    try {
      const result = await api<{ campaignId: string }>('/api/invitations/accept', {
        method: 'POST',
        body: JSON.stringify({ token: data.token })
      });
      await goto(`/campaigns/${result.campaignId}`, { invalidateAll: true });
    } catch (cause) {
      message = cause instanceof Error ? cause.message : t('auth.invite.failed');
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>{t('auth.invite.title')} · Atlore</title></svelte:head>
<AuthShell heading={t('auth.invite.heading')} subheading={t('auth.invite.subheading')}>
  {#if data.user}<button class="primary-button accept" disabled={busy} onclick={accept}
      >{busy
        ? t('auth.invite.opening')
        : t('auth.invite.acceptAs', { name: data.user.name })}</button
    >{:else}<a
      class="primary-button login"
      href={`/auth/login?next=${encodeURIComponent(`/invite?token=${data.token}`)}`}
      >{t('auth.invite.login')}</a
    >
    <p>
      {t('auth.invite.noAccount')}
      <a href={`/auth/register?next=${encodeURIComponent(`/invite?token=${data.token}`)}`}
        >{t('auth.invite.create')}</a
      >
    </p>{/if}{#if message}<AuthFormMessage {message} />{/if}
</AuthShell>

<style>
  .accept,
  .login {
    width: 100%;
    min-height: 46px;
    display: grid;
    place-items: center;
  }
  .login {
    color: #1a1206;
  }
  p {
    text-align: center;
    color: var(--text-3);
    font-size: 12px;
  }
</style>
