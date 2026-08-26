<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import LanguageSwitcher from '$lib/components/ui/LanguageSwitcher.svelte';
  import { tooltip } from '$lib/actions/tooltip';
  import type { SessionUser } from '$lib/types';
  import { t } from '$lib/i18n/index.svelte';

  let {
    user,
    save,
    changePassword,
    logout
  }: {
    user: SessionUser;
    save: (value: { name: string; email: string; color: string }) => Promise<void>;
    changePassword: (value: { currentPassword: string; newPassword: string }) => Promise<void>;
    logout: () => Promise<void>;
  } = $props();

  let root: HTMLElement;
  let open = $state(false);
  let name = $state('');
  let email = $state('');
  let color = $state('#f0913f');
  let theme = $state<'dark' | 'light'>('dark');
  let busy = $state(false);
  let passwordBusy = $state(false);
  let message = $state('');
  let currentPassword = $state('');
  let newPassword = $state('');
  let repeatPassword = $state('');

  $effect(() => {
    name = user.name;
    email = user.email;
    color = user.color;
  });

  onMount(() => {
    theme = localStorage.getItem('atlore-theme') === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    const outside = (event: PointerEvent) => {
      if (open && !root.contains(event.target as Node)) open = false;
    };
    const key = (event: KeyboardEvent) => event.key === 'Escape' && (open = false);
    document.addEventListener('pointerdown', outside);
    window.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('keydown', key);
    };
  });

  function selectTheme(next: 'dark' | 'light') {
    theme = next;
    localStorage.setItem('atlore-theme', next);
    document.documentElement.dataset.theme = next;
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    message = '';
    try {
      await save({ name, email, color });
      message = t('account.saved');
    } catch (cause) {
      message = cause instanceof Error ? cause.message : t('account.saveFailed');
    } finally {
      busy = false;
    }
  }

  async function submitPassword(event: SubmitEvent) {
    event.preventDefault();
    message = '';
    if (newPassword !== repeatPassword) {
      message = t('account.passwordMismatch');
      return;
    }
    passwordBusy = true;
    try {
      await changePassword({ currentPassword, newPassword });
      currentPassword = '';
      newPassword = '';
      repeatPassword = '';
      message = t('account.passwordSaved');
    } catch (cause) {
      message = cause instanceof Error ? cause.message : t('account.passwordFailed');
    } finally {
      passwordBusy = false;
    }
  }
</script>

<div class="account-menu" bind:this={root}>
  <button
    class="avatar"
    class:open
    aria-label={t('account.open')}
    aria-expanded={open}
    use:tooltip={t('account.open')}
    style:--account-color={user.color}
    onclick={() => (open = !open)}>{user.name.slice(0, 1).toUpperCase()}</button
  >
  {#if open}<div class="menu panel-surface" role="dialog" aria-label={t('account.title')}>
      <header>
        <span style:--account-color={user.color}>{user.name.slice(0, 1).toUpperCase()}</span>
        <div><b>{user.name}</b><small>{user.email}</small></div>
        <button class="icon-button" aria-label={t('common.close')} onclick={() => (open = false)}
          ><Icon name="close" size={14} /></button
        >
      </header>
      <form class="profile" onsubmit={submit}>
        <div class="eyebrow">{t('account.profile')}</div>
        <label
          >{t('account.name')}<input
            class="field"
            bind:value={name}
            minlength="2"
            maxlength="80"
            required
          /></label
        >
        <label
          >{t('account.email')}<input
            class="field"
            type="email"
            bind:value={email}
            maxlength="254"
            required
          /></label
        >
        <label class="colour"
          >{t('account.color')}<span
            ><input type="color" bind:value={color} /><code>{color}</code></span
          ></label
        >
        <button class="secondary-button save" disabled={busy}
          >{busy ? t('common.saving') : t('account.save')}</button
        >
      </form>
      <form class="password" onsubmit={submitPassword}>
        <div class="eyebrow">{t('account.password')}</div>
        <label
          >{t('account.currentPassword')}<input
            class="field"
            type="password"
            autocomplete="current-password"
            bind:value={currentPassword}
            required
          /></label
        >
        <label
          >{t('account.newPassword')}<input
            class="field"
            type="password"
            autocomplete="new-password"
            minlength="10"
            bind:value={newPassword}
            required
          /></label
        >
        <label
          >{t('account.repeatPassword')}<input
            class="field"
            type="password"
            autocomplete="new-password"
            minlength="10"
            bind:value={repeatPassword}
            required
          /></label
        >
        <button class="secondary-button password-save" disabled={passwordBusy}
          >{passwordBusy ? t('common.saving') : t('account.savePassword')}</button
        >
      </form>
      <section class="preferences">
        <div class="eyebrow">{t('account.preferences')}</div>
        <div class="setting-row">
          <span>{t('account.appearance')}</span>
          <div class="theme-choice">
            <button class:active={theme === 'dark'} onclick={() => selectTheme('dark')}
              >☾ {t('account.dark')}</button
            >
            <button class:active={theme === 'light'} onclick={() => selectTheme('light')}
              >☀ {t('account.light')}</button
            >
          </div>
        </div>
        <div class="setting-row">
          <span>{t('language.label')}</span><LanguageSwitcher compact />
        </div>
      </section>
      {#if message}<p class="message" role="status">{message}</p>{/if}
      <button class="logout" onclick={logout}
        ><Icon name="back" size={14} />{t('campaigns.logout')}</button
      >
    </div>{/if}
</div>

<style>
  .account-menu {
    position: relative;
    z-index: 45;
  }
  .avatar {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border: 1.5px solid var(--account-color);
    border-radius: 50%;
    background: color-mix(in srgb, var(--account-color) 9%, var(--bg-2));
    color: var(--account-color);
    font: 13px var(--font-mono);
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--account-color) 18%, transparent);
    transition:
      box-shadow 0.16s ease,
      background 0.16s ease;
  }
  .avatar:hover,
  .avatar.open {
    background: color-mix(in srgb, var(--account-color) 16%, var(--bg-2));
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--account-color) 13%, transparent);
  }
  .menu {
    position: absolute;
    top: calc(100% + 9px);
    right: 0;
    width: min(330px, calc(100vw - 24px));
    max-height: calc(100dvh - 70px);
    overflow-x: hidden;
    overflow-y: auto;
    box-shadow: 0 24px 65px rgba(0, 0, 0, 0.52);
    animation: account-in 0.16s var(--ease-atlore);
  }
  header {
    min-height: 62px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 11px;
    border-bottom: 1px solid var(--line);
  }
  header > span {
    width: 34px;
    height: 34px;
    display: grid;
    flex: 0 0 auto;
    place-items: center;
    border: 1px solid var(--account-color);
    border-radius: 50%;
    color: var(--account-color);
    font: 12px var(--font-mono);
  }
  header > div {
    min-width: 0;
    flex: 1;
  }
  header b,
  header small {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  header b {
    font-size: 13px;
  }
  header small {
    margin-top: 2px;
    color: var(--text-3);
    font-size: 10.5px;
  }
  form,
  .preferences {
    padding: 13px;
    border-bottom: 1px solid var(--line);
  }
  .profile {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 9px;
  }
  .profile .eyebrow,
  .profile label:nth-of-type(2) {
    grid-column: 1/-1;
  }
  label,
  .colour {
    color: var(--text-3);
    font-size: 10.5px;
  }
  label .field {
    height: 35px;
    margin-top: 4px;
    font-size: 12px;
  }
  .colour > span {
    height: 35px;
    display: flex;
    align-items: center;
    gap: 7px;
    margin-top: 4px;
    padding: 0 8px 0 4px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--canvas);
  }
  input[type='color'] {
    width: 28px;
    height: 27px;
    padding: 0;
    border: 0;
    background: transparent;
  }
  code {
    color: var(--text-2);
    font: 9.5px var(--font-mono);
  }
  .save {
    align-self: end;
    min-height: 35px;
  }
  .password {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 9px;
  }
  .password .eyebrow,
  .password label:first-of-type {
    grid-column: 1/-1;
  }
  .password-save {
    min-height: 35px;
    align-self: end;
  }
  .preferences .eyebrow {
    margin-bottom: 8px;
  }
  .setting-row {
    min-height: 38px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    color: var(--text-2);
    font-size: 11.5px;
  }
  .theme-choice {
    display: flex;
    gap: 2px;
    padding: 2px;
    border-radius: 8px;
    background: var(--canvas);
  }
  .theme-choice button {
    min-height: 29px;
    padding: 0 8px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--text-3);
    font-size: 10.5px;
  }
  .theme-choice button.active {
    background: var(--bg-3);
    color: var(--ember);
  }
  .message {
    margin: 0;
    padding: 8px 13px;
    color: var(--ember);
    font-size: 11px;
  }
  .logout {
    width: 100%;
    min-height: 42px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 13px;
    border: 0;
    background: transparent;
    color: var(--danger);
    font-size: 12px;
    text-align: left;
  }
  .logout:hover {
    background: color-mix(in srgb, var(--danger) 8%, transparent);
  }
  @keyframes account-in {
    from {
      opacity: 0;
      transform: translateY(-4px) scale(0.985);
    }
  }
</style>
