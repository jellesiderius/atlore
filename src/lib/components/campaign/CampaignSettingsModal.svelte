<script lang="ts">
  import Modal from '$lib/components/ui/Modal.svelte';
  import { DEFAULT_RIGHTS, OPEN_RIGHTS, STRICT_RIGHTS } from '$lib/domain/constants';
  import type { CampaignSettingsTab, RightKey, Rights, WorkspaceSnapshot } from '$lib/types';
  import { t } from '$lib/i18n/index.svelte';
  let {
    snapshot,
    tab = 'general',
    onTab = () => undefined,
    close,
    save,
    invite,
    roleChange,
    remove,
    destroy
  }: {
    snapshot: WorkspaceSnapshot;
    tab?: CampaignSettingsTab;
    onTab?: (tab: CampaignSettingsTab) => void;
    close: () => void;
    save: (value: Record<string, unknown>) => Promise<void>;
    invite: (value: { email: string; name: string; role: 'gm' | 'player' }) => Promise<void>;
    roleChange: (id: string, role: 'gm' | 'player') => Promise<void>;
    remove: (id: string) => Promise<void>;
    destroy: () => Promise<void>;
  } = $props();
  // svelte-ignore state_referenced_locally -- modal form state is intentionally initialized once
  let title = $state(snapshot.campaign.title);
  // svelte-ignore state_referenced_locally -- modal form state is intentionally initialized once
  let system = $state(snapshot.campaign.system);
  // svelte-ignore state_referenced_locally -- modal form state is intentionally initialized once
  let note = $state(snapshot.campaign.note);
  // svelte-ignore state_referenced_locally -- modal form state is intentionally initialized once
  let rights = $state<Rights>({ ...snapshot.campaign.rights });
  let email = $state('');
  let inviteName = $state('');
  let busy = $state(false);
  let message = $state('');
  const groups: [string, [RightKey, string][]][] = [
    [
      'world',
      [
        ['create', 'create'],
        ['edit', 'edit'],
        ['link', 'link'],
        ['delete', 'delete'],
        ['image', 'image']
      ]
    ],
    [
      'sessions',
      [
        ['write', 'write'],
        ['session', 'session'],
        ['history', 'history']
      ]
    ],
    [
      'maps',
      [
        ['mapUpload', 'mapUpload'],
        ['pin', 'pin']
      ]
    ],
    [
      'secrets',
      [
        ['reveal', 'reveal'],
        ['seeSecret', 'seeSecret'],
        ['dmNotes', 'dmNotes']
      ]
    ],
    [
      'management',
      [
        ['invite', 'invite'],
        ['settings', 'settings']
      ]
    ]
  ];
  async function wrap(run: () => Promise<void>) {
    busy = true;
    message = '';
    try {
      await run();
      message = t('campaign.settings.saved');
    } catch (cause) {
      message = cause instanceof Error ? cause.message : t('campaign.settings.saveFailed');
    } finally {
      busy = false;
    }
  }
  function preset(value: Rights) {
    rights = { ...value };
  }
</script>

<Modal title={snapshot.campaign.title} eyebrow={t('campaign.settings.eyebrow')} {close} wide>
  <div class="tabs">
    {#each [['general', 'campaign.settings.general'], ['members', 'campaign.settings.membersTab'], ['rights', 'campaign.settings.rightsTab']] as item}<button
        class:active={tab === item[0]}
        onclick={() => onTab(item[0] as CampaignSettingsTab)}>{t(item[1])}</button
      >{/each}
  </div>
  {#if tab === 'general'}
    <div class="form-grid">
      <label>{t('campaign.settings.name')}<input class="field" bind:value={title} /></label><label
        >{t('campaign.settings.system')}<input class="field" bind:value={system} /></label
      ><label class="full"
        >{t('campaign.settings.description')}<textarea class="field" rows="4" bind:value={note}
        ></textarea></label
      >
    </div>
    <div class="bottom">
      <button
        class="danger-button"
        disabled={snapshot.campaign.role !== 'gm' || busy}
        onclick={() => confirm(t('campaign.settings.deleteConfirm')) && wrap(destroy)}
        >{t('campaign.settings.deleteCampaign')}</button
      ><button
        class="primary-button"
        disabled={busy}
        onclick={() => wrap(() => save({ title, system, note }))}
        >{t('campaign.settings.saveChanges')}</button
      >
    </div>
  {:else if tab === 'members'}
    <div class="members">
      {#each snapshot.members as member}<div class="member">
          <span class="avatar" style:border-color={member.color} style:color={member.color}
            >{member.name.slice(0, 1).toUpperCase()}</span
          ><span><b>{member.name}</b><small>{member.email}</small></span><select
            class="mini-field"
            value={member.role}
            disabled={snapshot.campaign.role !== 'gm' || busy}
            onchange={(event) =>
              wrap(() =>
                roleChange(
                  member.id,
                  (event.currentTarget as HTMLSelectElement).value as 'gm' | 'player'
                )
              )}
            ><option value="gm">{t('common.gameMaster')}</option><option value="player"
              >{t('common.player')}</option
            ></select
          >{#if member.id !== snapshot.currentUser.id && snapshot.campaign.role === 'gm'}<button
              class="icon-remove"
              aria-label={t('campaign.settings.removeMember')}
              onclick={() => wrap(() => remove(member.id))}>×</button
            >{/if}
        </div>{/each}
    </div>
    <form
      class="invite"
      onsubmit={(event) => {
        event.preventDefault();
        wrap(async () => {
          await invite({ email, name: inviteName, role: 'player' });
          email = '';
          inviteName = '';
        });
      }}
    >
      <div class="eyebrow">{t('campaign.settings.invitePerson')}</div>
      <div>
        <input
          class="field"
          bind:value={inviteName}
          placeholder={t('campaign.settings.optionalName')}
        /><input
          class="field"
          type="email"
          bind:value={email}
          placeholder={t('campaign.settings.inviteEmail')}
          required
        /><button class="primary-button" disabled={busy}>{t('campaign.settings.invite')}</button>
      </div>
    </form>
  {:else}
    <div class="presets">
      <button onclick={() => preset(DEFAULT_RIGHTS)}>{t('campaign.settings.standard')}</button
      ><button onclick={() => preset(OPEN_RIGHTS)}>{t('campaign.settings.open')}</button><button
        onclick={() => preset(STRICT_RIGHTS)}>{t('campaign.settings.strict')}</button
      >
    </div>
    <p class="hint">{t('campaign.settings.rightsHint')}</p>
    <div class="rights">
      {#each groups as [group, items]}<section>
          <div class="eyebrow">{t(`campaign.settings.groups.${group}`)}</div>
          {#each items as [key, label]}<button
              class="right-row"
              onclick={() => (rights[key] = !rights[key])}
              ><span>{t(`campaign.settings.rights.${label}`)}</span><span
                class:on={rights[key]}
                class="switch"><i></i></span
              ></button
            >{/each}
        </section>{/each}
    </div>
    <div class="bottom right">
      <button class="primary-button" disabled={busy} onclick={() => wrap(() => save({ rights }))}
        >{t('campaign.settings.saveRights')}</button
      >
    </div>
  {/if}
  {#if message}<div
      class:bad={message !== t('campaign.settings.saved')}
      class="message"
      role="status"
    >
      {message}
    </div>{/if}
</Modal>

<style>
  .tabs {
    display: flex;
    gap: 3px;
    margin: -8px 0 18px;
    padding: 4px;
    border-radius: 10px;
    background: var(--bg-3);
  }
  .tabs button {
    flex: 1;
    min-height: 34px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: var(--text-3);
    font-size: 12.5px;
  }
  .tabs button.active {
    background: var(--bg-2);
    color: var(--text);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  }
  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  .form-grid label {
    font-size: 12px;
    color: var(--text-2);
  }
  .form-grid .field {
    display: block;
    margin-top: 5px;
  }
  .form-grid .full {
    grid-column: 1/-1;
  }
  .bottom {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin-top: 20px;
  }
  .bottom.right {
    justify-content: flex-end;
  }
  .members {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .member {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 48px;
    padding: 5px 8px;
    border-radius: 9px;
    background: var(--bg-3);
  }
  .avatar {
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    border: 1.5px solid;
    border-radius: 50%;
  }
  .member > span:nth-child(2) {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .member b {
    font-weight: 500;
  }
  .member small {
    color: var(--text-3);
  }
  .mini-field {
    min-height: 32px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--bg-2);
    padding: 0 8px;
    font-size: 12px;
  }
  .icon-remove {
    width: 30px;
    height: 30px;
    border: 0;
    background: transparent;
    color: var(--text-3);
    font-size: 18px;
  }
  .invite {
    margin-top: 18px;
    padding-top: 16px;
    border-top: 1px solid var(--line);
  }
  .invite > div:last-child {
    display: grid;
    grid-template-columns: 1fr 1.3fr auto;
    gap: 7px;
    margin-top: 8px;
  }
  .presets {
    display: flex;
    gap: 6px;
  }
  .presets button {
    min-height: 32px;
    padding: 0 10px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: transparent;
    color: var(--text-2);
    font-size: 12px;
  }
  .hint {
    color: var(--text-3);
    font-size: 12px;
  }
  .rights {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  .rights section {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .right-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 34px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--text-2);
    font-size: 12.5px;
    text-align: left;
  }
  .right-row:hover {
    background: var(--bg-3);
  }
  .switch {
    position: relative;
    width: 28px;
    height: 16px;
    border-radius: 9px;
    background: var(--line-2);
  }
  .switch i {
    position: absolute;
    width: 12px;
    height: 12px;
    left: 2px;
    top: 2px;
    border-radius: 50%;
    background: var(--text-3);
    transition: left 0.16s;
  }
  .switch.on {
    background: var(--ember);
  }
  .switch.on i {
    left: 14px;
    background: #1a1206;
  }
  .message {
    margin-top: 12px;
    color: #63c4a8;
    font-size: 12px;
  }
  .message.bad {
    color: var(--danger);
  }
  @media (max-width: 620px) {
    .form-grid,
    .rights {
      grid-template-columns: 1fr;
    }
    .invite > div:last-child {
      grid-template-columns: 1fr;
    }
    .bottom {
      flex-wrap: wrap;
    }
    .member small {
      display: none;
    }
  }
</style>
