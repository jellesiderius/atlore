<script lang="ts">
  import { onMount } from 'svelte';
  import { searchNodes, fold } from '$lib/domain/search';
  import { normalizeBody } from '$lib/domain/text';
  import type { NodeType, Paragraph, WorldNode } from '$lib/types';
  import { nodeTypeLabel, t } from '$lib/i18n/index.svelte';

  let {
    body,
    nodes,
    types,
    placeholder = '',
    readonly = false,
    ariaLabel = '',
    onChange,
    openNode,
    createNode
  }: {
    body: Paragraph[];
    nodes: WorldNode[];
    types: NodeType[];
    placeholder?: string;
    readonly?: boolean;
    ariaLabel?: string;
    onChange?: (body: Paragraph[]) => void;
    openNode?: (id: string) => void;
    createNode?: (title: string, insert: (id: string) => void) => void;
  } = $props();

  let editor: HTMLDivElement;
  let menu = $state<{ query: string; x: number; y: number; index: number } | null>(null);
  let mentionAnchor: { node: Text; start: number; end: number } | null = null;
  let suggestionTimer: ReturnType<typeof setTimeout>;
  let lastExternal = '';
  let typeMap = $derived(new Map(types.map((type) => [type.key, type])));
  let results = $derived.by(() => {
    if (!menu) return [];
    if (menu.query.trim()) return searchNodes(nodes, menu.query, { limit: 8 });
    return nodes.filter((node) => !node.trashedAt && node.type !== 'session').slice(0, 8);
  });
  let canCreate = $derived(!!createNode && !!menu?.query.trim());

  onMount(() => {
    render(normalizeBody(body));
    const outside = (event: PointerEvent) => {
      if (!editor.contains(event.target as Node)) menu = null;
    };
    document.addEventListener('pointerdown', outside);
    return () => {
      document.removeEventListener('pointerdown', outside);
      clearTimeout(suggestionTimer);
    };
  });

  $effect(() => {
    const signature = JSON.stringify(body);
    if (editor && signature !== lastExternal && document.activeElement !== editor)
      render(normalizeBody(body));
  });

  function render(value: Paragraph[]) {
    editor.replaceChildren();
    for (const paragraph of value) {
      const element = document.createElement('div');
      for (const segment of paragraph.segs) {
        if (segment.t === 'txt') element.append(document.createTextNode(segment.v));
        else element.append(chip(segment.id));
      }
      if (!element.childNodes.length) element.append(document.createElement('br'));
      editor.append(element);
    }
    lastExternal = JSON.stringify(value);
  }

  function chip(id: string) {
    const node = nodes.find((item) => item.id === id);
    const element = document.createElement('span');
    element.dataset.ref = id;
    element.contentEditable = 'false';
    element.textContent = node?.title ?? `✦ ${t('editor.secret')}`;
    const color = node ? typeMap.get(node.type)?.colorDark : 'var(--text-3)';
    element.style.setProperty('--ref-color', color ?? 'var(--text-3)');
    return element;
  }

  function parse(): Paragraph[] {
    const paragraphElements = [...editor.childNodes];
    const paragraphs = paragraphElements.map((root) => {
      const segs: Paragraph['segs'] = [];
      const pushText = (value: string) => {
        const last = segs.at(-1);
        if (last?.t === 'txt') last.v += value;
        else segs.push({ t: 'txt', v: value });
      };
      const walk = (current: Node) => {
        if (current.nodeType === Node.TEXT_NODE) return pushText(current.textContent ?? '');
        if (current instanceof HTMLElement && current.dataset.ref)
          return segs.push({ t: 'ref', id: current.dataset.ref });
        if (current instanceof HTMLBRElement) return;
        current.childNodes.forEach(walk);
      };
      walk(root);
      return { segs: segs.length ? segs : [{ t: 'txt' as const, v: '' }] };
    });
    return normalizeBody(paragraphs);
  }

  function changed() {
    const value = parse();
    lastExternal = JSON.stringify(value);
    onChange?.(value);
    detectMention();
    clearTimeout(suggestionTimer);
    suggestionTimer = setTimeout(markSuggestions, 650);
  }

  function detectMention() {
    const selection = document.getSelection();
    if (
      !selection?.isCollapsed ||
      !selection.anchorNode ||
      selection.anchorNode.nodeType !== Node.TEXT_NODE
    ) {
      menu = null;
      mentionAnchor = null;
      return;
    }
    const text = selection.anchorNode.textContent?.slice(0, selection.anchorOffset) ?? '';
    const match = text.match(/(?:^|\s)@([\p{L}\p{N} _.'’-]{0,60})$/u);
    if (!match) {
      menu = null;
      mentionAnchor = null;
      return;
    }
    const start = selection.anchorOffset - match[1].length - 1;
    const range = document.createRange();
    range.setStart(selection.anchorNode, start);
    range.setEnd(selection.anchorNode, selection.anchorOffset);
    const rect = range.getBoundingClientRect();
    mentionAnchor = { node: selection.anchorNode as Text, start, end: selection.anchorOffset };
    menu = {
      query: match[1],
      x: Math.max(10, Math.min(innerWidth - 300, rect.left)),
      y: Math.min(innerHeight - 250, rect.bottom + 7),
      index: 0
    };
  }

  function insert(id: string) {
    if (!mentionAnchor?.node.isConnected) return;
    const anchor = mentionAnchor;
    const tail = anchor.node.splitText(anchor.end);
    anchor.node.deleteData(anchor.start, anchor.end - anchor.start);
    const element = chip(id);
    tail.parentNode?.insertBefore(element, tail);
    tail.parentNode?.insertBefore(document.createTextNode('\u00a0'), tail);
    const range = document.createRange();
    range.setStart(tail, 0);
    range.collapse(true);
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    menu = null;
    mentionAnchor = null;
    editor.focus();
    changed();
  }

  function createFromMenu(event: PointerEvent) {
    event.preventDefault();
    if (menu) createNode?.(menu.query.trim(), insert);
  }

  function keydown(event: KeyboardEvent) {
    if (!menu) return;
    const total = results.length + (canCreate ? 1 : 0);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      menu.index = (menu.index + (event.key === 'ArrowDown' ? 1 : total - 1)) % Math.max(1, total);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (menu.index < results.length) insert(results[menu.index].id);
      else if (canCreate) createNode?.(menu.query.trim(), insert);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      menu = null;
    }
  }

  function clicked(event: MouseEvent) {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-ref],[data-maybe]');
    if (target?.dataset.ref) openNode?.(target.dataset.ref);
    if (target?.dataset.maybe) {
      const id = target.dataset.maybe;
      target.replaceWith(chip(id), document.createTextNode('\u00a0'));
      changed();
    }
  }

  function markSuggestions() {
    if (!editor || readonly || nodes.length > 3_000) return;
    const selection = document.getSelection();
    const activeParagraph = selection?.anchorNode
      ? (selection.anchorNode.parentElement?.closest('[contenteditable] > div') ??
        selection.anchorNode.parentElement)
      : null;
    const candidates = nodes
      .filter((node) => !node.trashedAt && node.title.length > 2)
      .sort((a, b) => b.title.length - a.title.length)
      .slice(0, 400);
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    while (walker.nextNode()) {
      const text = walker.currentNode as Text;
      if (
        text.parentElement?.closest('[data-ref],[data-maybe]') ||
        text.parentElement === activeParagraph
      )
        continue;
      textNodes.push(text);
    }
    for (const text of textNodes) {
      const folded = fold(text.data);
      let match: { node: WorldNode; start: number } | null = null;
      for (const node of candidates) {
        const start = folded.indexOf(fold(node.title));
        if (start >= 0) {
          match = { node, start };
          break;
        }
      }
      if (!match) continue;
      const before = text.data.slice(0, match.start);
      const value = text.data.slice(match.start, match.start + match.node.title.length);
      const after = text.data.slice(match.start + match.node.title.length);
      const span = document.createElement('span');
      span.dataset.maybe = match.node.id;
      span.textContent = value;
      span.title = t('editor.connectTo', { title: match.node.title });
      text.replaceWith(document.createTextNode(before), span, document.createTextNode(after));
    }
  }
</script>

<div class="editor-wrap">
  <div
    bind:this={editor}
    class="editor"
    class:readonly
    contenteditable={!readonly}
    role="textbox"
    tabindex={readonly ? -1 : 0}
    aria-multiline="true"
    aria-label={ariaLabel || t('editor.ariaLabel')}
    data-placeholder={placeholder || t('editor.placeholder')}
    oninput={changed}
    onkeydown={keydown}
    onclick={clicked}
  ></div>
</div>
{#if menu}
  <div class="mention-menu" style:left={`${menu.x}px`} style:top={`${menu.y}px`} role="listbox">
    {#each results as node, index}<button
        class:active={menu.index === index}
        onpointerdown={(event) => {
          event.preventDefault();
          insert(node.id);
        }}
        ><span style:background={typeMap.get(node.type)?.colorDark}></span><b>{node.title}</b><small
          >{typeMap.get(node.type) ? nodeTypeLabel(typeMap.get(node.type)!, 'singular') : ''}</small
        ></button
      >{/each}
    {#if canCreate}<button
        class="new"
        class:active={menu.index === results.length}
        onpointerdown={createFromMenu}
        ><span>+</span><b>{t('editor.newNode', { title: menu.query.trim() })}</b></button
      >{/if}
    {#if !results.length && !canCreate}<div class="empty">{t('editor.noResults')}</div>{/if}
  </div>
{/if}

<style>
  .editor {
    min-height: 160px;
    font-size: 15px;
    line-height: 1.74;
    color: var(--text-2);
    outline: 0;
    user-select: text;
    -webkit-user-select: text;
    white-space: pre-wrap;
  }
  .editor:empty::before {
    content: attr(data-placeholder);
    color: var(--text-3);
    pointer-events: none;
  }
  .editor.readonly {
    cursor: default;
  }
  :global(.editor > div) {
    min-height: 1.74em;
    margin-bottom: 1em;
  }
  :global(.editor [data-ref]) {
    display: inline;
    padding: 1px 6px;
    border-radius: 5px;
    background: color-mix(in srgb, var(--ref-color) 13%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ref-color) 24%, transparent);
    color: var(--ref-color);
    cursor: pointer;
  }
  :global(.editor [data-ref]:hover) {
    background: color-mix(in srgb, var(--ref-color) 20%, transparent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--ref-color) 18%, transparent);
  }
  :global(.editor [data-maybe]) {
    border-bottom: 1px dotted var(--ember);
    cursor: pointer;
  }
  .mention-menu {
    position: fixed;
    z-index: 95;
    width: min(290px, calc(100vw - 20px));
    max-height: 270px;
    overflow-y: auto;
    padding: 5px;
    border: 1px solid var(--line-2);
    border-radius: 11px;
    background: var(--bg-2);
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.48);
    animation: fade-in 0.12s ease;
  }
  .mention-menu button {
    width: 100%;
    min-height: 36px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 9px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--text);
    text-align: left;
  }
  .mention-menu button:hover,
  .mention-menu button.active {
    background: var(--bg-3);
  }
  .mention-menu button > span {
    width: 7px;
    height: 7px;
    flex: 0 0 auto;
    border-radius: 50%;
  }
  .mention-menu button > b {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    font-weight: 500;
  }
  .mention-menu button > small {
    font: 9px var(--font-mono);
    color: var(--text-3);
  }
  .mention-menu button.new {
    border-top: 1px solid var(--line);
    margin-top: 3px;
    border-radius: 0 0 8px 8px;
    color: var(--ember);
  }
  .mention-menu button.new span {
    width: 17px;
    height: 17px;
    display: grid;
    place-items: center;
    border: 1px solid var(--line);
    background: transparent;
  }
  .empty {
    padding: 10px;
    color: var(--text-3);
    font-size: 12px;
  }
  @media (max-width: 600px) {
    .mention-menu {
      left: 10px !important;
      right: 10px;
      width: auto;
      max-height: 220px;
    }
  }
</style>
