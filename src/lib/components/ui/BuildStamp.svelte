<span class="build-stamp" data-testid="build-stamp" title={`Atlore build ${__ATLORE_BUILD__}`}
  >{__ATLORE_BUILD__}</span
>

<style>
  .build-stamp {
    position: absolute;
    z-index: 2;
    left: 50%;
    bottom: max(9px, env(safe-area-inset-bottom));
    transform: translateX(-50%);
    color: var(--text-3);
    font: 9px var(--font-mono);
    letter-spacing: 0.08em;
    opacity: 0.58;
    white-space: nowrap;
  }
</style>
