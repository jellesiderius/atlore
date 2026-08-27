<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import RemoteCursors, { type RemoteCursor } from './RemoteCursors.svelte';
  import TextSurface from './TextSurface.svelte';
  import { searchNodes, fold } from '$lib/domain/search';
  import { findNodeTitleMatches, normalizeBody } from '$lib/domain/text';
  import type { MenuItem } from '$lib/components/ui/ContextMenu.svelte';
  import type { NodeType, Paragraph, WorldNode } from '$lib/types';
  import { nodeTypeLabel, t } from '$lib/i18n/index.svelte';

  let {
    body,
    nodes,
    types,
    placeholder = '',
    readonly = false,
    compact = false,
    surfaceLabel = '',
    surfaceStatus = '',
    surfaceStatusTone = 'neutral',
    ariaLabel = '',
    excludeNodeId = null,
    onChange,
    openNode,
    previewNode,
    createNode,
    showContext,
    showNodeContext,
    remoteCursors = [],
    onCursor
  }: {
    body: Paragraph[];
    nodes: WorldNode[];
    types: NodeType[];
    placeholder?: string;
    readonly?: boolean;
    compact?: boolean;
    surfaceLabel?: string;
    surfaceStatus?: string;
    surfaceStatusTone?: 'neutral' | 'saving' | 'saved' | 'error' | 'live';
    ariaLabel?: string;
    excludeNodeId?: string | null;
    onChange?: (body: Paragraph[]) => void;
    openNode?: (id: string) => void;
    previewNode?: (id: string | null, x?: number, y?: number, delay?: number) => void;
    createNode?: (title: string, insert: (id: string) => void) => void;
    showContext?: (x: number, y: number, items: MenuItem[]) => void;
    showNodeContext?: (id: string, x: number, y: number, items?: MenuItem[]) => void;
    remoteCursors?: RemoteCursor[];
    onCursor?: (offset: number | null) => void;
  } = $props();

  let editorShell = $state<HTMLDivElement>(undefined!);
  let editor = $state<HTMLDivElement>(undefined!);
  let menu = $state<{ query: string; x: number; y: number; index: number } | null>(null);
  let mentionAnchor: { node: Text; start: number; end: number } | null = null;
  let suggestionTimer: ReturnType<typeof setTimeout>;
  let lastExternal = '';
  let typeMap = $derived(new Map(types.map((type) => [type.key, type])));
  let mentionNodes = $derived(nodes.filter((node) => node.id !== excludeNodeId));
  let results = $derived.by(() => {
    if (!menu) return [];
    if (menu.query.trim()) return searchNodes(mentionNodes, menu.query, { limit: 8 });
    return mentionNodes.filter((node) => !node.trashedAt && node.type !== 'session').slice(0, 8);
  });
  let canCreate = $derived.by(() => {
    if (!createNode || !menu) return false;

    const query = menu.query.trim();
    if (!query) return true;

    return !nodes.some(
      (node) => !node.trashedAt && node.type !== 'session' && fold(node.title) === fold(query)
    );
  });

  onMount(() => {
    render(normalizeBody(body));
    const outside = (event: PointerEvent) => {
      if (!editor.contains(event.target as Node)) menu = null;
    };
    const selectionChanged = () => reportCursor();
    document.addEventListener('pointerdown', outside);
    document.addEventListener('selectionchange', selectionChanged);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('selectionchange', selectionChanged);
      clearTimeout(suggestionTimer);
      onCursor?.(null);
    };
  });

  $effect(() => {
    const signature = JSON.stringify(body);
    if (editor && signature !== lastExternal) render(normalizeBody(body));
  });

  function render(value: Paragraph[]) {
    const selection = captureSelection();
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
    restoreSelection(selection);
  }

  type SelectionSnapshot = { start: number; end: number };
  type SelectionPoint = { node: Node; offset: number };

  function captureSelection(): SelectionSnapshot | null {
    const selection = document.getSelection();
    if (
      document.activeElement !== editor ||
      !selection?.rangeCount ||
      !selection.anchorNode ||
      !selection.focusNode ||
      !editor.contains(selection.anchorNode) ||
      !editor.contains(selection.focusNode)
    )
      return null;

    const range = selection.getRangeAt(0);
    return {
      start: textOffset(range.startContainer, range.startOffset),
      end: textOffset(range.endContainer, range.endOffset)
    };
  }

  function textOffset(node: Node, offset: number): number {
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.setEnd(node, offset);
    return range.cloneContents().textContent?.length ?? 0;
  }

  function restoreSelection(snapshot: SelectionSnapshot | null) {
    if (!snapshot) return;
    editor.focus({ preventScroll: true });
    const start = pointAtOffset(snapshot.start);
    const end = pointAtOffset(snapshot.end);
    const range = document.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    queueMicrotask(reportCursor);
  }

  function pointAtOffset(offset: number): SelectionPoint {
    let remaining = Math.max(0, offset);

    const visit = (parent: Node): SelectionPoint | null => {
      for (let index = 0; index < parent.childNodes.length; index++) {
        const child = parent.childNodes[index];
        if (child.nodeType === Node.TEXT_NODE) {
          const length = child.textContent?.length ?? 0;
          if (remaining <= length) return { node: child, offset: remaining };
          remaining -= length;
          continue;
        }
        if (!(child instanceof HTMLElement)) continue;
        if (child.dataset.ref) {
          const length = child.textContent?.length ?? 0;
          if (remaining === 0) return { node: parent, offset: index };
          if (remaining <= length) return { node: parent, offset: index + 1 };
          remaining -= length;
          continue;
        }
        if (child instanceof HTMLBRElement) {
          if (remaining === 0) return { node: parent, offset: index };
          continue;
        }
        const point = visit(child);
        if (point) return point;
      }
      return null;
    };

    return visit(editor) ?? { node: editor, offset: editor.childNodes.length };
  }

  function chip(id: string) {
    const node = nodes.find((item) => item.id === id);
    const element = document.createElement('span');
    element.dataset.ref = id;
    element.contentEditable = 'false';
    element.textContent = node?.title ?? `✦ ${t('editor.secret')}`;
    const type = node ? typeMap.get(node.type) : undefined;
    element.style.setProperty('--ref-color-dark', type?.colorDark ?? 'var(--text-3)');
    element.style.setProperty('--ref-color-light', type?.colorLight ?? 'var(--text-3)');
    return element;
  }

  function parse(): Paragraph[] {
    const paragraphs: Paragraph[] = [];
    let segs: Paragraph['segs'] = [];
    let justBroke = false;
    const blockTags = new Set(['DIV', 'P', 'LI', 'H1', 'H2', 'H3', 'BLOCKQUOTE']);
    const appendText = (value: string) => {
      const lines = value.replace(/\r/g, '').split('\n');
      lines.forEach((line, index) => {
        if (line) {
          const last = segs.at(-1);
          if (last?.t === 'txt') last.v += line;
          else segs.push({ t: 'txt', v: line });
          justBroke = false;
        }
        if (index < lines.length - 1) breakParagraph();
      });
    };
    const breakParagraph = () => {
      paragraphs.push({ segs: segs.length ? segs : [{ t: 'txt', v: '' }] });
      segs = [];
      justBroke = true;
    };
    const walk = (current: Node, root = false) => {
      if (current.nodeType === Node.TEXT_NODE) {
        appendText(current.textContent ?? '');
        return;
      }
      if (current instanceof HTMLElement && current.dataset.ref) {
        segs.push({ t: 'ref', id: current.dataset.ref });
        justBroke = false;
        return;
      }
      if (current instanceof HTMLBRElement) {
        breakParagraph();
        return;
      }
      const isNestedBlock =
        !root && current instanceof HTMLElement && blockTags.has(current.tagName);
      if (isNestedBlock && segs.length) breakParagraph();
      current.childNodes.forEach((child) => walk(child));
      if (isNestedBlock && (!justBroke || segs.length)) breakParagraph();
    };

    for (const child of editor.childNodes) {
      const isBlock = child instanceof HTMLElement && blockTags.has(child.tagName);
      if (isBlock && segs.length) breakParagraph();
      walk(child, isBlock);
      if (isBlock && (!justBroke || segs.length)) breakParagraph();
    }
    if (segs.length || !paragraphs.length) breakParagraph();
    return normalizeBody(paragraphs);
  }

  function changed() {
    const value = parse();
    lastExternal = JSON.stringify(value);
    onChange?.(value);
    detectMention();
    clearTimeout(suggestionTimer);
    suggestionTimer = setTimeout(markSuggestions, 650);
    queueMicrotask(reportCursor);
  }

  function reportCursor() {
    if (!onCursor || !editor) return;
    const selection = document.getSelection();
    if (!selection?.rangeCount || !selection.anchorNode || !editor.contains(selection.anchorNode))
      return;
    try {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.setEnd(selection.anchorNode, selection.anchorOffset);
      onCursor(range.cloneContents().textContent?.length ?? 0);
    } catch {
      onCursor(null);
    }
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

  function preview(event: PointerEvent) {
    const target =
      event.target instanceof Element ? event.target.closest<HTMLElement>('[data-ref]') : null;
    const id = target?.dataset.ref;
    if (!target || !id || !nodes.some((node) => node.id === id && !node.trashedAt)) return;
    const previous =
      event.relatedTarget instanceof Element
        ? event.relatedTarget.closest<HTMLElement>('[data-ref]')
        : null;
    if (previous === target) return;
    const rect = target.getBoundingClientRect();
    previewNode?.(id, rect.left - 12, rect.bottom + 8, 300);
  }

  function previewOut(event: PointerEvent) {
    const target =
      event.target instanceof Element ? event.target.closest<HTMLElement>('[data-ref]') : null;
    if (!target) return;
    const next =
      event.relatedTarget instanceof Element
        ? event.relatedTarget.closest<HTMLElement>('[data-ref]')
        : null;
    if (next === target) return;
    previewNode?.(null);
  }

  function contextmenu(event: MouseEvent) {
    if (!readonly && showContext) {
      const selection = selectionInfo();
      if (selection) {
        event.preventDefault();
        event.stopPropagation();
        const existing = nodes.find(
          (node) =>
            node.id !== excludeNodeId &&
            !node.trashedAt &&
            node.type !== 'session' &&
            fold(node.title) === fold(selection.text)
        );
        const item: MenuItem = existing
          ? {
              label: t('editor.linkSelection', { title: existing.title }),
              icon: 'link',
              run: () => replaceSelection(selection.range, existing.id)
            }
          : {
              label: t('editor.createFromSelection', { title: selection.text }),
              icon: 'plus',
              run: () => createNode?.(selection.text, (id) => replaceSelection(selection.range, id))
            };
        showContext(event.clientX, event.clientY, [item]);
        return;
      }
    }

    const target =
      event.target instanceof Element ? event.target.closest<HTMLElement>('[data-ref]') : null;
    const id = target?.dataset.ref;
    if (!id || !nodes.some((node) => node.id === id && !node.trashedAt) || !showNodeContext) return;

    event.preventDefault();
    event.stopPropagation();
    const extras: MenuItem[] = readonly
      ? []
      : [
          {
            label: t('editor.detach'),
            icon: 'cut',
            run: () => {
              if (!target.isConnected) return;
              target.replaceWith(document.createTextNode(target.textContent ?? ''));
              changed();
            }
          }
        ];
    showNodeContext(id, event.clientX, event.clientY, extras);
  }

  function selectionInfo(): { text: string; range: Range } | null {
    const selection = document.getSelection();
    if (!selection?.rangeCount || selection.isCollapsed) return null;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return null;
    const text = selection.toString().trim();
    if (!text || text.length > 60) return null;
    return { text, range: range.cloneRange() };
  }

  function replaceSelection(range: Range, id: string) {
    if (!range.startContainer.isConnected) return;
    range.deleteContents();
    const element = chip(id);
    range.insertNode(element);
    range.setStartAfter(element);
    range.collapse(true);
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    editor.focus();
    changed();
  }

  function markSuggestions() {
    if (!editor || readonly || menu || nodes.length > 3_000) return;
    const candidates = nodes
      .filter(
        (node) =>
          node.id !== excludeNodeId &&
          !node.trashedAt &&
          node.type !== 'session' &&
          node.title.length > 2
      )
      .sort((a, b) => b.title.length - a.title.length)
      .slice(0, 400)
      .map((node) => ({ id: node.id, title: node.title }));

    const paragraphs = editor.children.length ? ([...editor.children] as HTMLElement[]) : [editor];
    for (const paragraph of paragraphs) {
      const offset = caretOffset(paragraph);
      let changed = false;

      for (const old of paragraph.querySelectorAll<HTMLElement>('[data-maybe]')) {
        old.replaceWith(document.createTextNode(old.textContent ?? ''));
        changed = true;
      }
      if (changed) paragraph.normalize();

      const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
      const textNodes: Text[] = [];
      while (walker.nextNode()) {
        const text = walker.currentNode as Text;
        if (!text.parentElement?.closest('[data-ref]')) textNodes.push(text);
      }

      for (const text of textNodes) {
        const matches = findNodeTitleMatches(text.data, candidates);
        if (!matches.length) continue;

        const fragment = document.createDocumentFragment();
        let position = 0;
        for (const match of matches) {
          if (match.start > position)
            fragment.append(document.createTextNode(text.data.slice(position, match.start)));
          const span = document.createElement('span');
          span.dataset.maybe = match.id;
          span.textContent = text.data.slice(match.start, match.end);
          span.title = t('editor.connectTo', { title: match.title });
          fragment.append(span);
          position = match.end;
        }
        if (position < text.data.length)
          fragment.append(document.createTextNode(text.data.slice(position)));
        text.replaceWith(fragment);
        changed = true;
      }

      if (changed && offset !== null) restoreCaret(paragraph, offset);
    }
  }

  function caretOffset(paragraph: HTMLElement): number | null {
    const selection = document.getSelection();
    if (
      !selection?.rangeCount ||
      !selection.anchorNode ||
      !paragraph.contains(selection.anchorNode)
    )
      return null;
    const range = selection.getRangeAt(0).cloneRange();
    range.selectNodeContents(paragraph);
    range.setEnd(selection.anchorNode, selection.anchorOffset);
    return range.toString().length;
  }

  function restoreCaret(paragraph: HTMLElement, offset: number) {
    let remaining = offset;
    const selection = document.getSelection();
    const range = document.createRange();

    const visit = (parent: Node): boolean => {
      for (const child of parent.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          const length = child.textContent?.length ?? 0;
          if (remaining <= length) {
            range.setStart(child, remaining);
            range.collapse(true);
            return true;
          }
          remaining -= length;
          continue;
        }
        if (!(child instanceof HTMLElement)) continue;
        if (child.dataset.ref) {
          const length = child.textContent?.length ?? 0;
          if (remaining <= length) {
            range.setStartAfter(child);
            range.collapse(true);
            return true;
          }
          remaining -= length;
          continue;
        }
        if (visit(child)) return true;
      }
      return false;
    };

    if (!visit(paragraph)) {
      range.selectNodeContents(paragraph);
      range.collapse(false);
    }
    selection?.removeAllRanges();
    selection?.addRange(range);
  }
</script>

<TextSurface
  mode={readonly ? 'read' : 'write'}
  label={surfaceLabel || t(readonly ? 'editor.readSurface' : 'editor.writeSurface')}
  hint={!readonly && Boolean(createNode) ? t('editor.mentionHint') : ''}
  status={surfaceStatus}
  statusTone={surfaceStatusTone}
  {compact}
>
  <div class="editor-shell" bind:this={editorShell}>
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
      onfocus={reportCursor}
      onblur={() => onCursor?.(null)}
      onpointerover={preview}
      onpointerout={previewOut}
      oncontextmenu={contextmenu}
    ></div>
    <RemoteCursors host={editorShell} content={editor} cursors={remoteCursors} />
  </div>
</TextSurface>
{#if menu}
  <div class="mention-menu" style:left={`${menu.x}px`} style:top={`${menu.y}px`} role="listbox">
    <div class="mention-results">
      {#each results as node, index}<button
          class:active={menu.index === index}
          onpointerdown={(event) => {
            event.preventDefault();
            insert(node.id);
          }}
          ><span style:background={typeMap.get(node.type)?.colorDark}></span><b>{node.title}</b
          ><small
            >{typeMap.get(node.type)
              ? nodeTypeLabel(typeMap.get(node.type)!, 'singular')
              : ''}</small
          ></button
        >{/each}
      {#if !results.length && !canCreate}<div class="empty">{t('editor.noResults')}</div>{/if}
    </div>
    {#if canCreate}<button
        class="new"
        class:active={menu.index === results.length}
        onpointerdown={createFromMenu}
        ><span><Icon name="plus" size={11} strokeWidth={2} /></span><b
          >{menu.query.trim()
            ? t('editor.newNode', { title: menu.query.trim() })
            : t('editor.createNode')}</b
        ></button
      >{/if}
  </div>
{/if}

<style>
  .editor-shell {
    position: relative;
  }
  .editor {
    min-height: 160px;
    font-size: 15px;
    line-height: 1.74;
    color: var(--text);
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
    --ref-color: var(--ref-color-dark);
    display: inline;
    padding: 1px 6px;
    border-radius: 5px;
    background: color-mix(in srgb, var(--ref-color) 13%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ref-color) 24%, transparent);
    color: var(--ref-color);
    cursor: pointer;
  }
  :global(:root[data-theme='light'] .editor [data-ref]) {
    --ref-color: var(--ref-color-light);
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
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: 5px;
    border: 1px solid var(--line-2);
    border-radius: 11px;
    background: var(--bg-2);
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.48);
    animation: fade-in 0.12s ease;
  }
  .mention-results {
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
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
    flex: 0 0 auto;
    border-top: 1px solid var(--line);
    margin-top: 3px;
    border-radius: 0 0 8px 8px;
    color: var(--ember);
  }
  .mention-menu button.new span {
    width: 17px;
    height: 17px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
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
