<script lang="ts">
  import { onMount } from 'svelte';
  import '../app.css';
  import { initializeLocale } from '$lib/i18n/index.svelte';

  let { children } = $props();

  onMount(() => {
    initializeLocale();
    const theme = localStorage.getItem('atlore-theme') === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    document
      .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'light' ? '#f5f3ef' : '#1a1816');
    document.documentElement.dataset.hydrated = 'true';
  });
</script>

{@render children()}
