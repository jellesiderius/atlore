<script lang="ts">
  let {
    name,
    size = 18,
    strokeWidth = 1.7,
    label
  }: { name: string; size?: number; strokeWidth?: number; label?: string } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={strokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden={label ? undefined : 'true'}
  role={label ? 'img' : undefined}
>
  {#if label}<title>{label}</title>{/if}
  {#if name === 'graph'}
    <circle cx="6" cy="7" r="2.4" /><circle cx="18" cy="6" r="2.4" /><circle
      cx="12"
      cy="18"
      r="2.4"
    /><path d="M7.9 8.6 10.8 15.9M16.4 8 13.3 16M8.4 6.6h7.2" />
  {:else if name === 'session'}
    <rect x="5" y="3.5" width="14" height="17" rx="2" /><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4" />
  {:else if name === 'story'}
    <path
      d="M4 4.5h5.5A2.5 2.5 0 0 1 12 7v13a2 2 0 0 0-2-2H4zM20 4.5h-5.5A2.5 2.5 0 0 0 12 7v13a2 2 0 0 1 2-2h6z"
    />
  {:else if name === 'atlas'}
    <path d="M9 3.5 3.5 6v14.5L9 18l6 2.5 5.5-2.5V3.5L15 6zM9 3.5V18M15 6v14.5" />
  {:else if name === 'search'}
    <circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" />
  {:else if name === 'clock'}
    <circle cx="12" cy="12" r="8" /><path d="M12 7.5V12l3 2" />
  {:else if name === 'settings'}
    <path d="M4 8h10M18 8h2M4 16h4M12 16h8" /><circle cx="16" cy="8" r="2" /><circle
      cx="10"
      cy="16"
      r="2"
    />
  {:else if name === 'edit'}
    <path d="M4 20h4l11-11-4-4L4 16v4zM13.5 6.5l4 4M12 20h8" />
  {:else if name === 'panel'}
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" /><path d="M9.5 4.5v15" />
  {:else if name === 'back'}
    <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />
  {:else if name === 'close'}
    <path d="M6 6l12 12M18 6 6 18" />
  {:else if name === 'plus'}
    <path d="M12 5v14M5 12h14" />
  {:else if name === 'trash'}
    <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 10v6M14 10v6" />
  {:else if name === 'link'}
    <path
      d="M9.5 14.5l5-5M7.2 17.8l-1 .9a3.3 3.3 0 0 1-4.7-4.7l3.1-3.1a3.3 3.3 0 0 1 4.7 0M16.8 6.2l1-.9a3.3 3.3 0 0 1 4.7 4.7l-3.1 3.1a3.3 3.3 0 0 1-4.7 0"
    />
  {:else if name === 'eye'}
    <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" /><circle
      cx="12"
      cy="12"
      r="2.6"
    />
  {:else if name === 'eye-off'}
    <path
      d="m4 4 16 16M10.6 6c.45-.1.92-.15 1.4-.15 6 0 9.5 6.15 9.5 6.15a16 16 0 0 1-2.1 2.9M6.2 7.2C3.8 9 2.5 12 2.5 12s3.5 6.15 9.5 6.15c1.3 0 2.45-.28 3.45-.75M9.9 9.9a3 3 0 0 0 4.2 4.2"
    />
  {:else if name === 'fit'}
    <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />
  {:else if name === 'upload'}
    <path d="M12 16V4M7.5 8.5 12 4l4.5 4.5M4 15v5h16v-5" />
  {:else if name === 'pin'}
    <path d="M15 4l5 5-3 2-4 5-1 5-2-2 1-5 5-4zM4 20l6-6" />
  {:else if name === 'lock'}
    <rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" />
  {:else if name === 'unlock'}
    <rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 7-2.6" />
  {:else if name === 'menu'}
    <path d="M4 7h16M4 12h16M4 17h16" />
  {:else if name === 'undo'}
    <path d="M9 7 4 12l5 5M5 12h8a6 6 0 0 1 6 6" />
  {:else if name === 'open'}
    <path
      d="M14 4.5h5.5V10M19 5l-7.5 7.5M18.5 14v4.5A1.5 1.5 0 0 1 17 20H6a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 6 5.5h4.5"
    />
  {:else if name === 'cut'}
    <circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><path
      d="m8.2 7.2 11.3 6.3M8.2 16.8 19.5 10.5M12 12l-3.8 2.2"
    />
  {:else if name === 'shuffle'}
    <path
      d="M4 7h3c5 0 5 10 10 10h3M17 4l3 3-3 3M4 17h3c1.7 0 2.8-1.1 3.8-2.6M14 7.6c.8-.4 1.8-.6 3.2-.6H20M17 14l3 3-3 3"
    />
  {:else if name === 'unpin'}
    <path d="M5 4l15 15M15 4l5 5-2.4 1.6M13 16l-1 5-2-2 .6-3M4 20l5-5" />
  {:else if name === 'more'}
    <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle
      cx="12"
      cy="12"
      r="1"
      fill="currentColor"
      stroke="none"
    /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
  {:else}
    <circle cx="12" cy="12" r="8" /><path d="M12 8v4M12 16h.01" />
  {/if}
</svg>
