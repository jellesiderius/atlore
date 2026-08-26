<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import AuthFormMessage from '$lib/components/auth/AuthFormMessage.svelte';
  import AuthShell from '$lib/components/auth/AuthShell.svelte';
  import { api } from '$lib/client/api';

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
      message = cause instanceof Error ? cause.message : 'Inloggen is mislukt.';
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>Inloggen · Atlore</title></svelte:head>

<AuthShell heading="Welkom terug" subheading="Log in om verder te gaan waar de tafel gebleven was.">
  <form onsubmit={submit}>
    <label class="screen-reader-only" for="email">E-mailadres</label>
    <input
      class="field"
      id="email"
      type="email"
      autocomplete="email"
      placeholder="E-mailadres"
      bind:value={email}
      required
    />
    <label class="screen-reader-only" for="password">Wachtwoord</label>
    <input
      class="field"
      id="password"
      type="password"
      autocomplete="current-password"
      placeholder="Wachtwoord"
      bind:value={password}
      required
    />
    {#if message}<AuthFormMessage {message} />{/if}
    <button class="primary-button submit" disabled={busy}
      >{busy ? 'Even wachten…' : 'Inloggen'}</button
    >
    <div class="links">
      <a href="/auth/forgot">Wachtwoord vergeten</a><span
        >Nog geen account? <a href="/auth/register">Aanmelden</a></span
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
