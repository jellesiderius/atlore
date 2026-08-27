<script lang="ts">
  import Starfield from '$lib/components/visual/Starfield.svelte';
  import BrandLogo from '$lib/components/ui/BrandLogo.svelte';
  import LanguageSwitcher from '$lib/components/ui/LanguageSwitcher.svelte';
  let {
    heading,
    subheading,
    children
  }: {
    heading: string;
    subheading: string;
    children: import('svelte').Snippet;
  } = $props();
</script>

<main class="auth-shell">
  <Starfield />
  <div class="vignette"></div>
  <div class="language"><LanguageSwitcher compact /></div>
  <section>
    <header>
      <div class="brand"><BrandLogo eager /></div>
      <h1 class="serif-title">{heading}</h1>
      <p>{subheading}</p>
      <div class="divider-mark"><span></span></div>
    </header>
    <div class="form-wrap">{@render children()}</div>
  </section>
</main>

<style>
  .auth-shell {
    position: relative;
    isolation: isolate;
    min-height: 100dvh;
    display: grid;
    place-items: center;
    overflow: hidden;
    padding: 32px 18px;
    background:
      radial-gradient(
        120% 78% at 50% 118%,
        rgba(240, 145, 63, 0.15) 0%,
        rgba(240, 145, 63, 0.04) 38%,
        transparent 68%
      ),
      radial-gradient(90% 60% at 50% -20%, rgba(127, 179, 255, 0.07), transparent 60%),
      var(--canvas);
  }
  .vignette {
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    background: radial-gradient(120% 90% at 50% 50%, transparent 45%, rgba(0, 0, 0, 0.5) 100%);
  }
  .language {
    position: absolute;
    z-index: 2;
    right: 14px;
    top: max(14px, env(safe-area-inset-top));
  }
  section {
    position: relative;
    z-index: 1;
    width: min(360px, 100%);
    animation: lift-in 0.42s var(--ease-atlore);
  }
  header {
    text-align: center;
    margin-bottom: 22px;
  }
  .brand {
    --brand-logo-width: 310px;
    display: flex;
    justify-content: center;
    margin: 0 0 14px;
  }
  h1 {
    font-size: 40px;
    line-height: 1.06;
    margin: 0 0 8px;
  }
  p {
    font-size: 13.5px;
    line-height: 1.6;
    color: var(--text-3);
    margin: 0;
    text-wrap: pretty;
  }
  .divider-mark {
    margin: 20px 0 0;
  }
  .form-wrap {
    width: 100%;
  }
  @media (max-width: 500px) {
    .auth-shell {
      align-items: start;
      padding-top: max(8vh, 64px);
    }
    .brand {
      --brand-logo-width: 290px;
      margin: 0 auto 12px;
    }
    h1 {
      font-size: 36px;
    }
  }
</style>
