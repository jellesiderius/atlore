<script lang="ts">
  import { t } from '$lib/i18n/index.svelte';
  export interface RemoteCursor {
    userId: string;
    userName: string;
    userColor: string;
    offset: number;
  }

  let {
    host,
    content,
    cursors = []
  }: {
    host?: HTMLElement;
    content?: HTMLElement;
    cursors?: RemoteCursor[];
  } = $props();

  let markers = $state<(RemoteCursor & { x: number; y: number; height: number })[]>([]);

  $effect(() => {
    const hostElement = host;
    const contentElement = content;
    cursors.map((cursor) => `${cursor.userId}:${cursor.offset}:${cursor.userColor}`).join('|');
    if (!hostElement || !contentElement) {
      markers = [];
      return;
    }

    const position = () => {
      const hostRect = hostElement.getBoundingClientRect();
      markers = cursors.flatMap((cursor) => {
        const rect = caretRect(contentElement, cursor.offset);
        if (!rect) return [];
        return [
          {
            ...cursor,
            x: Math.max(0, rect.x - hostRect.x),
            y: Math.max(0, rect.y - hostRect.y),
            height: Math.max(18, rect.height || 0)
          }
        ];
      });
    };
    const resize = new ResizeObserver(position);
    const mutation = new MutationObserver(position);
    resize.observe(contentElement);
    mutation.observe(contentElement, { childList: true, characterData: true, subtree: true });
    const frame = requestAnimationFrame(position);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutation.disconnect();
    };
  });

  function caretRect(root: HTMLElement, offset: number): DOMRect | null {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let remaining = Math.max(0, offset);
    let last: Text | null = null;
    while (walker.nextNode()) {
      const text = walker.currentNode as Text;
      last = text;
      if (remaining <= text.length) return rangeRect(text, remaining);
      remaining -= text.length;
    }
    if (last) return rangeRect(last, last.length);
    return root.firstElementChild?.getBoundingClientRect() ?? root.getBoundingClientRect();
  }

  function rangeRect(node: Text, offset: number): DOMRect {
    const range = document.createRange();
    range.setStart(node, Math.min(offset, node.length));
    range.collapse(true);
    let rect = range.getClientRects()[0] ?? range.getBoundingClientRect();
    if ((!rect.height || !rect.width) && offset > 0) {
      range.setStart(node, offset - 1);
      range.setEnd(node, offset);
      const previous = range.getBoundingClientRect();
      rect = new DOMRect(previous.right, previous.top, 0, previous.height);
    }
    return rect;
  }
</script>

{#each markers as cursor (cursor.userId)}<span
    class="remote-cursor"
    style:left={`${cursor.x}px`}
    style:top={`${cursor.y}px`}
    style:height={`${cursor.height}px`}
    style:--cursor-color={cursor.userColor}
    aria-label={t('editor.remoteCursor', { name: cursor.userName })}><b>{cursor.userName}</b></span
  >{/each}

<style>
  .remote-cursor {
    position: absolute;
    z-index: 4;
    width: 2px;
    border-radius: 2px;
    background: var(--cursor-color);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--canvas) 65%, transparent);
    pointer-events: none;
    animation: cursor-in 0.14s ease-out;
  }
  .remote-cursor b {
    position: absolute;
    left: -1px;
    bottom: calc(100% + 3px);
    max-width: 130px;
    overflow: hidden;
    padding: 2px 5px;
    border-radius: 4px 4px 4px 0;
    background: var(--cursor-color);
    color: #1a1816;
    font: 8.5px/1.35 var(--font-mono);
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  @keyframes cursor-in {
    from {
      opacity: 0;
      transform: translateY(3px);
    }
  }
</style>
