<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import AuthFormMessage from '$lib/components/auth/AuthFormMessage.svelte';
  import AuthShell from '$lib/components/auth/AuthShell.svelte';
  import { api } from '$lib/client/api';
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
      message = cause instanceof Error ? cause.message : 'Aanmelden is mislukt.';
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>Account maken · Atlore</title></svelte:head>
<AuthShell
  heading="Neem plaats"
  subheading="Maak een account en begin een wereld die met elk verhaal groeit."
>
  <form onsubmit={submit}>
    <input
      class="field"
      aria-label="Naam"
      autocomplete="name"
      placeholder="Hoe mogen we je noemen?"
      bind:value={name}
      required
    />
    <input
      class="field"
      aria-label="E-mailadres"
      type="email"
      autocomplete="email"
      placeholder="E-mailadres"
      bind:value={email}
      required
    />
    <input
      class="field"
      aria-label="Wachtwoord"
      type="password"
      autocomplete="new-password"
      placeholder="Wachtwoord · minstens 10 tekens"
      minlength="10"
      bind:value={password}
      required
    />
    {#if message}<AuthFormMessage {message} />{/if}
    <button class="primary-button submit" disabled={busy}
      >{busy ? 'Even wachten…' : 'Account maken'}</button
    >
    <p>Al een account? <a href="/auth/login">Inloggen</a></p>
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
