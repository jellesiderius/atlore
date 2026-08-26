<script lang="ts">
  import { goto } from '$app/navigation';
  import AuthShell from '$lib/components/auth/AuthShell.svelte';
  import AuthFormMessage from '$lib/components/auth/AuthFormMessage.svelte';
  import { api } from '$lib/client/api';
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
      message = cause instanceof Error ? cause.message : 'Uitnodiging accepteren is mislukt.';
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>Uitnodiging · Atlore</title></svelte:head>
<AuthShell
  heading="Er staat een stoel klaar"
  subheading="Je bent uitgenodigd om samen een wereld te bouwen."
>
  {#if data.user}<button class="primary-button accept" disabled={busy} onclick={accept}
      >{busy ? 'Openen…' : `Accepteer als ${data.user.name}`}</button
    >{:else}<a
      class="primary-button login"
      href={`/auth/login?next=${encodeURIComponent(`/invite?token=${data.token}`)}`}
      >Log in om te accepteren</a
    >
    <p>
      Nog geen account? <a
        href={`/auth/register?next=${encodeURIComponent(`/invite?token=${data.token}`)}`}
        >Maak er een</a
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
