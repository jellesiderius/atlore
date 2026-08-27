<script lang="ts">
  let {
    alt = 'Atlore',
    eager = false
  }: {
    alt?: string;
    eager?: boolean;
  } = $props();
</script>

<picture class="brand-logo">
  <source srcset="/brand/atlore-wide.webp" type="image/webp" />
  <img
    src="/brand/atlore-wide.png"
    {alt}
    width="2172"
    height="724"
    loading={eager ? 'eager' : 'lazy'}
    fetchpriority={eager ? 'high' : 'auto'}
    decoding="async"
  />
</picture>

<style>
  .brand-logo {
    display: block;
    width: min(var(--brand-logo-width, 320px), 100%);
  }
  img {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 3 / 1;
    object-fit: contain;
    filter: drop-shadow(0 10px 28px rgba(0, 0, 0, 0.32));
  }
</style>
