<script lang="ts">
  import { onMount } from 'svelte';
  import '../app.css';
  import { initializeLocale } from '$lib/i18n/index.svelte';

  let { children } = $props();

  onMount(initializeLocale);
</script>

{@render children()}
