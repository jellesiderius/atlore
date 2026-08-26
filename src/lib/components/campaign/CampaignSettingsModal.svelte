<script lang="ts">
  import Modal from '$lib/components/ui/Modal.svelte';
  import { DEFAULT_RIGHTS, OPEN_RIGHTS, STRICT_RIGHTS } from '$lib/domain/constants';
  import type { RightKey, Rights, WorkspaceSnapshot } from '$lib/types';
  let {
    snapshot,
    close,
    save,
    invite,
    roleChange,
    remove,
    destroy
  }: {
    snapshot: WorkspaceSnapshot;
    close: () => void;
    save: (value: Record<string, unknown>) => Promise<void>;
    invite: (value: { email: string; name: string; role: 'gm' | 'player' }) => Promise<void>;
    roleChange: (id: string, role: 'gm' | 'player') => Promise<void>;
    remove: (id: string) => Promise<void>;
    destroy: () => Promise<void>;
  } = $props();
  let tab = $state<'general' | 'members' | 'rights'>('general');
  // svelte-ignore state_referenced_locally -- modal form state is intentionally initialized once
  let title = $state(snapshot.campaign.title);
  // svelte-ignore state_referenced_locally -- modal form state is intentionally initialized once
  let system = $state(snapshot.campaign.system);
  // svelte-ignore state_referenced_locally -- modal form state is intentionally initialized once
  let note = $state(snapshot.campaign.note);
  // svelte-ignore state_referenced_locally -- modal form state is intentionally initialized once
  let rights = $state<Rights>(structuredClone(snapshot.campaign.rights));
  let email = $state('');
  let inviteName = $state('');
  let busy = $state(false);
  let message = $state('');
  const groups: [string, [RightKey, string][]][] = [
    [
      'De wereld',
      [
        ['create', 'Nodes aanmaken'],
        ['edit', 'Nodes bewerken'],
        ['link', 'Nodes koppelen'],
        ['delete', 'Verwijderen'],
        ['image', 'Afbeeldingen toevoegen']
      ]
    ],
    [
      'Sessies',
      [
        ['write', 'Sessies schrijven'],
        ['session', 'Sessies starten'],
        ['history', 'Versies terugzetten']
      ]
    ],
    [
      'Kaarten',
      [
        ['mapUpload', 'Kaarten uploaden'],
        ['pin', 'Markers plaatsen']
      ]
    ],
    [
      'Geheimen',
      [
        ['reveal', 'Onthullen en verbergen'],
        ['seeSecret', 'Geheimen inzien'],
        ['dmNotes', 'DM-notities lezen']
      ]
    ],
    [
      'Beheer',
      [
        ['invite', 'Mensen uitnodigen'],
        ['settings', 'Instellingen wijzigen']
      ]
    ]
  ];
  async function wrap(run: () => Promise<void>) {
    busy = true;
    message = '';
    try {
      await run();
      message = 'Opgeslagen.';
    } catch (cause) {
      message = cause instanceof Error ? cause.message : 'Opslaan is mislukt.';
    } finally {
      busy = false;
    }
  }
  function preset(value: Rights) {
    rights = structuredClone(value);
  }
</script>

<Modal title={snapshot.campaign.title} eyebrow="Campagne-instellingen" {close} wide>
  <div class="tabs">
    {#each [['general', 'Algemeen'], ['members', 'Wie speelt mee'], ['rights', 'Rechten']] as item}<button
        class:active={tab === item[0]}
        onclick={() => (tab = item[0] as typeof tab)}>{item[1]}</button
      >{/each}
  </div>
  {#if tab === 'general'}
    <div class="form-grid">
      <label>Naam<input class="field" bind:value={title} /></label><label
        >Systeem<input class="field" bind:value={system} /></label
      ><label class="full"
        >Omschrijving<textarea class="field" rows="4" bind:value={note}></textarea></label
      >
    </div>
    <div class="bottom">
      <button
        class="danger-button"
        disabled={snapshot.campaign.role !== 'gm' || busy}
        onclick={() => confirm('Deze campagne naar de prullenbak verplaatsen?') && wrap(destroy)}
        >Campagne verwijderen</button
      ><button
        class="primary-button"
        disabled={busy}
        onclick={() => wrap(() => save({ title, system, note }))}>Wijzigingen opslaan</button
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
            ><option value="gm">Spelleider</option><option value="player">Speler</option></select
          >{#if member.id !== snapshot.currentUser.id && snapshot.campaign.role === 'gm'}<button
              class="icon-remove"
              aria-label="Verwijderen"
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
      <div class="eyebrow">Iemand uitnodigen</div>
      <div>
        <input class="field" bind:value={inviteName} placeholder="Naam (optioneel)" /><input
          class="field"
          type="email"
          bind:value={email}
          placeholder="E-mailadres"
          required
        /><button class="primary-button" disabled={busy}>Uitnodigen</button>
      </div>
    </form>
  {:else}
    <div class="presets">
      <button onclick={() => preset(DEFAULT_RIGHTS)}>Standaard</button><button
        onclick={() => preset(OPEN_RIGHTS)}>Alles open</button
      ><button onclick={() => preset(STRICT_RIGHTS)}>Streng</button>
    </div>
    <p class="hint">De spelleider mag altijd alles. Deze schakelaars gelden voor spelers.</p>
    <div class="rights">
      {#each groups as [group, items]}<section>
          <div class="eyebrow">{group}</div>
          {#each items as [key, label]}<button
              class="right-row"
              onclick={() => (rights[key] = !rights[key])}
              ><span>{label}</span><span class:on={rights[key]} class="switch"><i></i></span
              ></button
            >{/each}
        </section>{/each}
    </div>
    <div class="bottom right">
      <button class="primary-button" disabled={busy} onclick={() => wrap(() => save({ rights }))}
        >Rechten opslaan</button
      >
    </div>
  {/if}
  {#if message}<div class:bad={!message.includes('Opgeslagen')} class="message" role="status">
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
