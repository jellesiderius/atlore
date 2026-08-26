<script lang="ts">
  import Modal from '$lib/components/ui/Modal.svelte';
  let {
    close,
    create
  }: {
    close: () => void;
    create: (value: { title: string; system: string; note: string }) => Promise<void>;
  } = $props();
  let title = $state('');
  let system = $state('Daggerheart');
  let note = $state('');
  let busy = $state(false);
  let message = $state('');
  async function submit(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    message = '';
    try {
      await create({ title, system, note });
    } catch (cause) {
      message = cause instanceof Error ? cause.message : 'Aanmaken is mislukt.';
    } finally {
      busy = false;
    }
  }
</script>

<Modal title="Nieuwe campagne" eyebrow="Een lege wereld" {close}>
  <form onsubmit={submit}>
    <label
      >Naam<input
        class="field title"
        bind:value={title}
        placeholder="Naam van de campagne"
        maxlength="120"
        required
      /></label
    >
    <label
      >Spelsysteem<select class="field" bind:value={system}
        ><option>Daggerheart</option><option>D&D 5e</option><option>Pathfinder 2e</option><option
          >Blades in the Dark</option
        ><option>Anders</option></select
      ></label
    >
    <label
      >Korte omschrijving<textarea
        class="field"
        bind:value={note}
        rows="3"
        maxlength="300"
        placeholder="Waar gaat deze wereld over?"></textarea></label
    >
    <p>Jij wordt spelleider. Anderen nodig je hierna uit.</p>
    {#if message}<div class="error" role="alert">{message}</div>{/if}
    <div class="actions">
      <button type="button" class="ghost-button" onclick={close}>Annuleer</button><button
        class="primary-button"
        disabled={busy}>{busy ? 'Wereld maken…' : 'Beginnen'}</button
      >
    </div>
  </form>
</Modal>

<style>
  form {
    display: flex;
    flex-direction: column;
    gap: 13px;
  }
  label {
    font-size: 12px;
    color: var(--text-2);
  }
  .field {
    display: block;
    margin-top: 5px;
  }
  .title {
    font: 19px var(--font-serif);
  }
  p {
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-3);
    margin: 0;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 7px;
    margin-top: 4px;
  }
  .error {
    color: var(--danger);
    font-size: 12px;
  }
</style>
