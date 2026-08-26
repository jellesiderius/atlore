<script lang="ts">
  let { message, kind = 'error' }: { message: string; kind?: 'error' | 'success' } = $props();
</script>

<div class:success={kind === 'success'} role={kind === 'error' ? 'alert' : 'status'}>{message}</div>

<style>
  div {
    margin: 3px 0 10px;
    font-size: 12.5px;
    line-height: 1.5;
    color: var(--danger);
  }
  .success {
    color: #63c4a8;
  }
</style>
