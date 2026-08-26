<script lang="ts">
  import { goto } from '$app/navigation';
  import AuthFormMessage from '$lib/components/auth/AuthFormMessage.svelte';
  import AuthShell from '$lib/components/auth/AuthShell.svelte';
  import { api } from '$lib/client/api';
  let { data }: { data: { token: string } } = $props();
  let password = $state('');
  let repeat = $state('');
  let busy = $state(false);
  let message = $state('');
  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (password !== repeat) {
      message = 'De wachtwoorden zijn niet gelijk.';
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
      message = cause instanceof Error ? cause.message : 'Herstellen is mislukt.';
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>Nieuw wachtwoord · Atlore</title></svelte:head>
<AuthShell heading="Een nieuw wachtwoord" subheading="Kies iets unieks van minstens tien tekens.">
  <form onsubmit={submit}>
    <input
      class="field"
      aria-label="Nieuw wachtwoord"
      type="password"
      autocomplete="new-password"
      minlength="10"
      placeholder="Nieuw wachtwoord"
      bind:value={password}
      required
    />
    <input
      class="field"
      aria-label="Herhaal wachtwoord"
      type="password"
      autocomplete="new-password"
      minlength="10"
      placeholder="Herhaal wachtwoord"
      bind:value={repeat}
      required
    />
    {#if message}<AuthFormMessage {message} />{/if}<button
      class="primary-button submit"
      disabled={busy}>{busy ? 'Opslaan…' : 'Wachtwoord opslaan'}</button
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
