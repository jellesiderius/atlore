<script lang="ts">
  import { goto, pushState, replaceState } from '$app/navigation';
  import { onMount } from 'svelte';
  import CampaignSettingsModal from '$lib/components/campaign/CampaignSettingsModal.svelte';
  import GraphCanvas from '$lib/components/graph/GraphCanvas.svelte';
  import GraphToolbar from '$lib/components/graph/GraphToolbar.svelte';
  import NodePopover from '$lib/components/graph/NodePopover.svelte';
  import NodePreview from '$lib/components/graph/NodePreview.svelte';
  import AtlasMap from '$lib/components/map/AtlasMap.svelte';
  import ConnectionModal from '$lib/components/node/ConnectionModal.svelte';
  import CreateNodeModal from '$lib/components/node/CreateNodeModal.svelte';
  import NodeDossier from '$lib/components/node/NodeDossier.svelte';
  import StoryView from '$lib/components/session/StoryView.svelte';
  import ContextMenu, { type MenuItem } from '$lib/components/ui/ContextMenu.svelte';
  import HistoryModal from '$lib/components/workspace/HistoryModal.svelte';
  import SearchPalette from '$lib/components/workspace/SearchPalette.svelte';
  import ExplorerPanel from '$lib/components/workspace/ExplorerPanel.svelte';
  import NavigationRail from '$lib/components/workspace/NavigationRail.svelte';
  import WorkspaceHeader from '$lib/components/workspace/WorkspaceHeader.svelte';
  import Modal from '$lib/components/ui/Modal.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';
  import ToastStack, { type Toast } from '$lib/components/ui/ToastStack.svelte';
  import { api, debounce } from '$lib/client/api';
  import { createClientId } from '$lib/client/id';
  import { may } from '$lib/domain/permissions';
  import { normalizeBody } from '$lib/domain/text';
  import { t } from '$lib/i18n/index.svelte';
  import type {
    MediaAsset,
    CampaignSettingsTab,
    ForceSettings,
    NodeDossierTab,
    Paragraph,
    PanelName,
    SessionEntry,
    VersionEntry,
    ViewName,
    WorldNode,
    WorkspaceSnapshot
  } from '$lib/types';
  let { data }: { data: { snapshot: WorkspaceSnapshot } } = $props();
  // svelte-ignore state_referenced_locally -- server data seeds the realtime client snapshot
  let snapshot = $state(data.snapshot);
  let view = $state<ViewName>('graph');
  let panel = $state<PanelName>('explorer');
  let nodeTab = $state<NodeDossierTab>('overview');
  let panelOpen = $state(typeof window === 'undefined' ? true : innerWidth >= 860);
  let selected = $state<string | null>(null);
  let popover = $state<string | null>(null);
  let previewId = $state<string | null>(null);
  let previewAnchor = $state({ x: 0, y: 0 });
  let previewShowTimer: ReturnType<typeof setTimeout>;
  let previewHideTimer: ReturnType<typeof setTimeout>;
  let popoverAnchor = $state({
    x: typeof window === 'undefined' ? 720 : innerWidth / 2,
    y: typeof window === 'undefined' ? 450 : innerHeight / 2
  });
  let dossier = $state<string | null>(null);
  let recent = $state<string[]>([]);
  let explorerTap: { id: string; at: number } | null = null;
  // svelte-ignore state_referenced_locally -- initial selection is recalculated after mutations
  let sessionId = $state(snapshot.sessions.find((item) => !item.trashedAt)?.id ?? '');
  let sessionEditing = $state(false);
  let createState = $state<{
    title: string;
    x: number;
    y: number;
    insert?: (id: string) => void;
  } | null>(null);
  let connectId = $state<string | null>(null);
  let context = $state<{ x: number; y: number; items: MenuItem[] } | null>(null);
  let palette = $state(false);
  let campaignSettings = $state<CampaignSettingsTab | null>(null);
  let sessionCreate = $state(false);
  let newSessionTitle = $state('');
  let newSessionDate = $state('');
  let history = $state<{
    type: 'node' | 'session';
    id: string;
    title: string;
    body: Paragraph[];
  } | null>(null);
  let theme = $state<'dark' | 'light'>('dark');
  let graph = $state<GraphCanvas>();
  // svelte-ignore state_referenced_locally -- server data seeds the persisted campaign setting
  let forceSettings = $state<ForceSettings>({ ...snapshot.campaign.forceSettings });
  let forceStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
  let forceSettingsDirty = false;
  let forceSettingsRevision = 0;
  let forceStatusTimer: ReturnType<typeof setTimeout> | undefined;
  let toasts = $state<Toast[]>([]);
  let realtimeStatus = $state<'connecting' | 'connected' | 'offline'>('connecting');
  let realtimeDrafts = $state<
    Record<
      string,
      { body: Paragraph[]; revision: string; userId: string; userName: string; receivedAt: number }
    >
  >({});
  type RealtimeCursor = {
    userId: string;
    userName: string;
    userColor: string;
    offset: number;
    revision: string;
    receivedAt: number;
  };
  let realtimeCursors = $state<Record<string, Record<string, RealtimeCursor>>>({});
  let realtimeNodeDrafts = $state<
    Record<
      string,
      { body: Paragraph[]; revision: string; userId: string; userName: string; receivedAt: number }
    >
  >({});
  let realtimeNodeCursors = $state<Record<string, Record<string, RealtimeCursor>>>({});
  let refreshing = false;
  let refreshQueued = false;
  let realtime: WebSocket | null = null;
  let pendingRealtimeDraft: { sessionId: string; body: Paragraph[] } | null = null;
  let realtimeDraftThrottle: ReturnType<typeof setTimeout> | undefined;
  let pendingRealtimeCursor: { sessionId: string; offset: number } | null = null;
  let realtimeCursorThrottle: ReturnType<typeof setTimeout> | undefined;
  let pendingRealtimeNodeDraft: { nodeId: string; body: Paragraph[] } | null = null;
  let realtimeNodeDraftThrottle: ReturnType<typeof setTimeout> | undefined;
  let pendingRealtimeNodeCursor: { nodeId: string; offset: number } | null = null;
  let realtimeNodeCursorThrottle: ReturnType<typeof setTimeout> | undefined;
  const realtimeCursorExpiry = new Map<string, ReturnType<typeof setTimeout>>();
  let nodeMap = $derived(new Map(snapshot.nodes.map((node) => [node.id, node])));
  let hasActiveNodes = $derived(snapshot.nodes.some((node) => !node.trashedAt));
  let popoverNode = $derived(popover ? nodeMap.get(popover) : undefined);
  let previewNodeEntry = $derived(previewId ? nodeMap.get(previewId) : undefined);
  let dossierNode = $derived(dossier ? nodeMap.get(dossier) : undefined);
  let typeMap = $derived(new Map(snapshot.nodeTypes.map((type) => [type.key, type])));
  const workspaceViews = new Set<ViewName>(['graph', 'session', 'atlas']);
  const workspacePanels = new Set<PanelName>(['explorer', 'recent', 'search', 'settings']);
  const dossierTabs = new Set<NodeDossierTab>(['overview', 'map', 'relations', 'story']);
  const campaignSettingsTabs = new Set<CampaignSettingsTab>(['general', 'members', 'rights']);
  const persistForceSettings = debounce(
    async (request: { settings: ForceSettings; revision: number }) => {
      try {
        await api(`/api/campaigns/${snapshot.campaign.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ forceSettings: request.settings }),
          keepalive: true
        });
        snapshot = {
          ...snapshot,
          campaign: {
            ...snapshot.campaign,
            forceSettings: { ...request.settings }
          }
        };
        if (request.revision !== forceSettingsRevision) return;
        forceSettingsDirty = false;
        forceStatus = 'saved';
        clearTimeout(forceStatusTimer);
        forceStatusTimer = setTimeout(() => (forceStatus = 'idle'), 1800);
      } catch (error) {
        if (request.revision !== forceSettingsRevision) return;
        forceSettingsDirty = false;
        forceSettings = { ...snapshot.campaign.forceSettings };
        forceStatus = 'error';
        notify(error instanceof Error ? error.message : t('explorer.forceSaveFailed'));
      }
    },
    350
  );
  function changeForceSettings(settings: ForceSettings) {
    forceSettings = { ...settings };
    forceSettingsDirty = true;
    forceStatus = 'saving';
    forceSettingsRevision += 1;
    persistForceSettings({ settings: { ...settings }, revision: forceSettingsRevision });
  }
  onMount(() => {
    const stored = localStorage.getItem('atlore-theme');
    theme = stored === 'light' ? 'light' : 'dark';
    applyTheme();
    const key = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        palette = true;
      }
      if (event.key === 'Escape') {
        selected = null;
        popover = null;
        context = null;
      }
    };
    window.addEventListener('keydown', key);
    const restore = () => restoreWorkspaceUrl(new URL(location.href));
    let realtimeTimer: ReturnType<typeof setTimeout>;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let realtimeConnecting = false;
    let reconnectAttempt = 0;
    let suspended = false;
    let disposed = false;
    const connectRealtime = () => {
      suspended = false;
      if (disposed || realtimeConnecting || realtime) return;
      realtimeStatus = 'connecting';
      realtimeConnecting = true;
      api<{ token: string; path: string }>(`/api/campaigns/${snapshot.campaign.id}/realtime`, {
        method: 'POST'
      })
        .then(({ token, path }) => {
          if (disposed || suspended) return;
          const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
          const socket = new WebSocket(
            `${protocol}//${location.host}${path}?token=${encodeURIComponent(token)}`
          );
          realtime = socket;
          socket.onopen = () => {
            reconnectAttempt = 0;
            realtimeStatus = 'connected';
          };
          socket.onmessage = (event) => {
            try {
              const message = JSON.parse(event.data);
              if (message.type === 'session:draft') receiveSessionDraft(message);
              if (message.type === 'session:presence') receiveSessionPresence(message);
              if (message.type === 'node:draft') receiveNodeDraft(message);
              if (message.type === 'node:presence') receiveNodePresence(message);
              if (message.type === 'invalidate') {
                clearTimeout(realtimeTimer);
                realtimeTimer = setTimeout(refresh, 180);
              }
            } catch {
              // Een beschadigd socketbericht mag de werkruimte niet onderbreken.
            }
          };
          socket.onclose = () => {
            if (realtime === socket) realtime = null;
            if (disposed || suspended) return;
            realtimeStatus = 'offline';
            const delay = Math.min(8_000, 500 * 2 ** reconnectAttempt++);
            clearTimeout(reconnectTimer);
            reconnectTimer = setTimeout(connectRealtime, delay);
          };
        })
        .catch(() => undefined)
        .finally(() => (realtimeConnecting = false));
    };
    const suspendRealtime = () => {
      suspended = true;
      clearTimeout(realtimeTimer);
      clearTimeout(reconnectTimer);
      realtime?.close();
      realtime = null;
      realtimeStatus = 'offline';
    };
    const leavePage = () => {
      void persistForceSettings.flush();
      suspendRealtime();
    };
    const restoreFromCache = (event: PageTransitionEvent) => {
      if (event.persisted) {
        restore();
        void refresh();
        connectRealtime();
      }
    };
    window.addEventListener('popstate', restore);
    window.addEventListener('pageshow', restoreFromCache);
    window.addEventListener('pagehide', leavePage);
    restore();
    connectRealtime();
    return () => {
      disposed = true;
      window.removeEventListener('keydown', key);
      window.removeEventListener('popstate', restore);
      window.removeEventListener('pageshow', restoreFromCache);
      window.removeEventListener('pagehide', leavePage);
      clearTimeout(previewShowTimer);
      clearTimeout(previewHideTimer);
      clearTimeout(forceStatusTimer);
      clearTimeout(realtimeDraftThrottle);
      clearTimeout(realtimeCursorThrottle);
      clearTimeout(realtimeNodeDraftThrottle);
      clearTimeout(realtimeNodeCursorThrottle);
      for (const timer of realtimeCursorExpiry.values()) clearTimeout(timer);
      realtimeCursorExpiry.clear();
      void persistForceSettings.flush();
      suspendRealtime();
    };
  });
  function can(right: Parameters<typeof may>[2]) {
    return !snapshot.viewAs && may(snapshot.campaign.role, snapshot.campaign.rights, right);
  }
  function applyTheme() {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'light' ? '#f5f3ef' : '#1a1816');
  }
  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('atlore-theme', theme);
    applyTheme();
  }
  function remember(id: string) {
    recent = [id, ...recent.filter((item) => item !== id)].slice(0, 20);
  }
  function restoreWorkspaceUrl(url: URL) {
    const requestedView = url.searchParams.get('view');
    view =
      requestedView === 'story'
        ? 'session'
        : workspaceViews.has(requestedView as ViewName)
          ? (requestedView as ViewName)
          : 'graph';
    sessionEditing =
      view === 'session' && requestedView !== 'story' && url.searchParams.get('mode') !== 'read';
    const requestedPanel = url.searchParams.get('panel') as PanelName | null;
    panel = requestedPanel && workspacePanels.has(requestedPanel) ? requestedPanel : 'explorer';
    if (requestedPanel && workspacePanels.has(requestedPanel)) panelOpen = true;
    const requestedSession = url.searchParams.get('session');
    if (requestedSession && snapshot.sessions.some((item) => item.id === requestedSession))
      sessionId = requestedSession;
    else if (!snapshot.sessions.some((item) => item.id === sessionId && !item.trashedAt))
      sessionId = snapshot.sessions.find((item) => !item.trashedAt)?.id ?? '';
    const requestedNode = url.searchParams.get('node');
    dossier =
      requestedNode && snapshot.nodes.some((item) => item.id === requestedNode && !item.trashedAt)
        ? requestedNode
        : null;
    const requestedNodeTab = url.searchParams.get('nodeTab') as NodeDossierTab | null;
    nodeTab =
      dossier && requestedNodeTab && dossierTabs.has(requestedNodeTab)
        ? requestedNodeTab
        : 'overview';
    const requestedSettingsTab = url.searchParams.get(
      'campaignSettings'
    ) as CampaignSettingsTab | null;
    campaignSettings =
      requestedSettingsTab && campaignSettingsTabs.has(requestedSettingsTab)
        ? requestedSettingsTab
        : null;
    if (dossier) {
      selected = dossier;
      remember(dossier);
    }
    popover = null;
    context = null;
  }
  function navigateWorkspace(
    next: {
      view?: ViewName;
      panel?: PanelName;
      sessionId?: string;
      sessionEditing?: boolean;
      dossier?: string | null;
      nodeTab?: NodeDossierTab;
      campaignSettings?: CampaignSettingsTab | null;
    },
    replace = false
  ) {
    if (next.view) {
      view = next.view;
      if (next.view !== 'session') sessionEditing = false;
    }
    if (next.panel) panel = next.panel;
    if (next.sessionId !== undefined) sessionId = next.sessionId;
    if (next.sessionEditing !== undefined) sessionEditing = next.sessionEditing;
    if (next.dossier !== undefined) {
      if (dossier !== next.dossier) nodeTab = 'overview';
      dossier = next.dossier;
    }
    if (next.nodeTab) nodeTab = next.nodeTab;
    if (next.campaignSettings !== undefined) campaignSettings = next.campaignSettings;
    popover = null;
    context = null;
    const url = new URL(location.href);
    if (view === 'graph') url.searchParams.delete('view');
    else url.searchParams.set('view', view);
    if (panel === 'explorer') url.searchParams.delete('panel');
    else url.searchParams.set('panel', panel);
    if (sessionId) url.searchParams.set('session', sessionId);
    else url.searchParams.delete('session');
    if (view === 'session') url.searchParams.set('mode', sessionEditing ? 'write' : 'read');
    else url.searchParams.delete('mode');
    if (dossier) url.searchParams.set('node', dossier);
    else url.searchParams.delete('node');
    if (dossier && nodeTab !== 'overview') url.searchParams.set('nodeTab', nodeTab);
    else url.searchParams.delete('nodeTab');
    if (campaignSettings) url.searchParams.set('campaignSettings', campaignSettings);
    else url.searchParams.delete('campaignSettings');
    if (url.href === location.href) return;
    if (replace) replaceState(url, {});
    else pushState(url, {});
  }
  function openNode(id: string) {
    dismissPreview();
    selected = id;
    remember(id);
    palette = false;
    if (innerWidth < 860) panelOpen = false;
    navigateWorkspace({ dossier: id });
  }
  function previewNode(id: string | null, x = 0, y = 0, delay = 300) {
    clearTimeout(previewShowTimer);
    if (!id) {
      previewHideTimer = setTimeout(() => (previewId = null), 220);
      return;
    }
    // Delayed previews are hover-only. A zero-delay request is an intentional
    // activation (for example, tapping a map marker) and must also work on touch.
    if ((delay > 0 && matchMedia('(hover: none)').matches) || popover || dossier) return;
    clearTimeout(previewHideTimer);
    if (previewId === id) return;
    previewShowTimer = setTimeout(() => {
      previewAnchor = { x, y };
      previewId = id;
    }, delay);
  }
  function keepPreview() {
    clearTimeout(previewHideTimer);
  }
  function dismissPreview() {
    clearTimeout(previewShowTimer);
    clearTimeout(previewHideTimer);
    previewId = null;
  }
  function selectNode(id: string | null) {
    selected = id;
    if (id) remember(id);
  }
  function graphSelect(id: string | null, clientX?: number, clientY?: number) {
    dismissPreview();
    selectNode(id);
    popover = id;
    if (id)
      popoverAnchor = {
        x: clientX ?? innerWidth / 2,
        y: clientY ?? innerHeight / 2
      };
  }
  function explorerSelect(id: string) {
    dismissPreview();
    popover = null;
    const now = performance.now();
    const openDossier = explorerTap?.id === id && now - explorerTap.at < 1200;
    explorerTap = openDossier ? null : { id, at: now };
    selectNode(id);
    if (view === 'graph') graph?.centerOn(id, 1);
    if (innerWidth < 860) panelOpen = false;
    if (openDossier) openNode(id);
  }
  function notify(text: string, action?: Toast['action']) {
    const id = createClientId();
    toasts = [...toasts, { id, text, action }];
    setTimeout(() => (toasts = toasts.filter((item) => item.id !== id)), 5000);
  }
  function sendPendingRealtimeDraft() {
    const pending = pendingRealtimeDraft;
    pendingRealtimeDraft = null;
    if (pending && realtime?.readyState === WebSocket.OPEN) {
      const encoded = JSON.stringify({ type: 'session:draft', ...pending });
      if (encoded.length <= 240 * 1024) realtime.send(encoded);
    }
    realtimeDraftThrottle = setTimeout(() => {
      realtimeDraftThrottle = undefined;
      if (pendingRealtimeDraft) sendPendingRealtimeDraft();
    }, 75);
  }
  function broadcastSessionBody(sessionId: string, body: Paragraph[]) {
    pendingRealtimeDraft = { sessionId, body: normalizeBody(body) };
    if (!realtimeDraftThrottle) sendPendingRealtimeDraft();
  }
  function sendRealtimeCursor(sessionId: string, offset: number | null) {
    if (realtime?.readyState !== WebSocket.OPEN) return;
    realtime.send(JSON.stringify({ type: 'session:presence', sessionId, offset }));
  }
  function sendPendingRealtimeCursor() {
    const pending = pendingRealtimeCursor;
    pendingRealtimeCursor = null;
    if (pending) sendRealtimeCursor(pending.sessionId, pending.offset);
    realtimeCursorThrottle = setTimeout(() => {
      realtimeCursorThrottle = undefined;
      if (pendingRealtimeCursor) sendPendingRealtimeCursor();
    }, 80);
  }
  function broadcastSessionCursor(sessionId: string, offset: number | null) {
    if (!sessionId) return;
    if (offset === null) {
      if (pendingRealtimeCursor?.sessionId === sessionId) pendingRealtimeCursor = null;
      sendRealtimeCursor(sessionId, null);
      return;
    }
    pendingRealtimeCursor = { sessionId, offset };
    if (!realtimeCursorThrottle) sendPendingRealtimeCursor();
  }
  function removeRealtimeCursor(sessionId: string, userId: string) {
    const cursors = realtimeCursors[sessionId];
    if (!cursors?.[userId]) return;
    const { [userId]: _removed, ...remaining } = cursors;
    const next = { ...realtimeCursors };
    if (Object.keys(remaining).length) next[sessionId] = remaining;
    else delete next[sessionId];
    realtimeCursors = next;
  }
  function receiveSessionPresence(message: {
    sessionId?: unknown;
    offset?: unknown;
    revision?: unknown;
    userId?: unknown;
    userName?: unknown;
    userColor?: unknown;
  }) {
    if (
      typeof message.sessionId !== 'string' ||
      (message.offset !== null &&
        (!Number.isInteger(message.offset) || Number(message.offset) < 0)) ||
      typeof message.revision !== 'string' ||
      typeof message.userId !== 'string' ||
      message.userId === snapshot.currentUser.id ||
      typeof message.userName !== 'string' ||
      typeof message.userColor !== 'string' ||
      !/^#[0-9a-f]{6}$/i.test(message.userColor) ||
      !snapshot.sessions.some((session) => session.id === message.sessionId)
    )
      return;
    const key = `${message.sessionId}:${message.userId}`;
    clearTimeout(realtimeCursorExpiry.get(key));
    if (message.offset === null) {
      realtimeCursorExpiry.delete(key);
      removeRealtimeCursor(message.sessionId, message.userId);
      return;
    }
    const cursor: RealtimeCursor = {
      userId: message.userId,
      userName: message.userName,
      userColor: message.userColor,
      offset: Number(message.offset),
      revision: message.revision,
      receivedAt: Date.now()
    };
    realtimeCursors = {
      ...realtimeCursors,
      [message.sessionId]: {
        ...realtimeCursors[message.sessionId],
        [message.userId]: cursor
      }
    };
    realtimeCursorExpiry.set(
      key,
      setTimeout(() => {
        realtimeCursorExpiry.delete(key);
        removeRealtimeCursor(message.sessionId as string, message.userId as string);
      }, 20_000)
    );
  }
  function sendPendingRealtimeNodeDraft() {
    const pending = pendingRealtimeNodeDraft;
    pendingRealtimeNodeDraft = null;
    if (pending && realtime?.readyState === WebSocket.OPEN) {
      const encoded = JSON.stringify({ type: 'node:draft', ...pending });
      if (encoded.length <= 240 * 1024) realtime.send(encoded);
    }
    realtimeNodeDraftThrottle = setTimeout(() => {
      realtimeNodeDraftThrottle = undefined;
      if (pendingRealtimeNodeDraft) sendPendingRealtimeNodeDraft();
    }, 75);
  }
  function broadcastNodeDescription(nodeId: string, body: Paragraph[]) {
    pendingRealtimeNodeDraft = { nodeId, body: normalizeBody(body) };
    if (!realtimeNodeDraftThrottle) sendPendingRealtimeNodeDraft();
  }
  function sendRealtimeNodeCursor(nodeId: string, offset: number | null) {
    if (realtime?.readyState !== WebSocket.OPEN) return;
    realtime.send(JSON.stringify({ type: 'node:presence', nodeId, offset }));
  }
  function sendPendingRealtimeNodeCursor() {
    const pending = pendingRealtimeNodeCursor;
    pendingRealtimeNodeCursor = null;
    if (pending) sendRealtimeNodeCursor(pending.nodeId, pending.offset);
    realtimeNodeCursorThrottle = setTimeout(() => {
      realtimeNodeCursorThrottle = undefined;
      if (pendingRealtimeNodeCursor) sendPendingRealtimeNodeCursor();
    }, 80);
  }
  function broadcastNodeCursor(nodeId: string, offset: number | null) {
    if (!nodeId) return;
    if (offset === null) {
      if (pendingRealtimeNodeCursor?.nodeId === nodeId) pendingRealtimeNodeCursor = null;
      sendRealtimeNodeCursor(nodeId, null);
      return;
    }
    pendingRealtimeNodeCursor = { nodeId, offset };
    if (!realtimeNodeCursorThrottle) sendPendingRealtimeNodeCursor();
  }
  function removeRealtimeNodeCursor(nodeId: string, userId: string) {
    const cursors = realtimeNodeCursors[nodeId];
    if (!cursors?.[userId]) return;
    const { [userId]: _removed, ...remaining } = cursors;
    const next = { ...realtimeNodeCursors };
    if (Object.keys(remaining).length) next[nodeId] = remaining;
    else delete next[nodeId];
    realtimeNodeCursors = next;
  }
  function receiveNodePresence(message: {
    nodeId?: unknown;
    offset?: unknown;
    revision?: unknown;
    userId?: unknown;
    userName?: unknown;
    userColor?: unknown;
  }) {
    if (
      typeof message.nodeId !== 'string' ||
      (message.offset !== null &&
        (!Number.isInteger(message.offset) || Number(message.offset) < 0)) ||
      typeof message.revision !== 'string' ||
      typeof message.userId !== 'string' ||
      message.userId === snapshot.currentUser.id ||
      typeof message.userName !== 'string' ||
      typeof message.userColor !== 'string' ||
      !/^#[0-9a-f]{6}$/i.test(message.userColor) ||
      !snapshot.nodes.some((node) => node.id === message.nodeId)
    )
      return;
    const key = `node:${message.nodeId}:${message.userId}`;
    clearTimeout(realtimeCursorExpiry.get(key));
    if (message.offset === null) {
      realtimeCursorExpiry.delete(key);
      removeRealtimeNodeCursor(message.nodeId, message.userId);
      return;
    }
    const cursor: RealtimeCursor = {
      userId: message.userId,
      userName: message.userName,
      userColor: message.userColor,
      offset: Number(message.offset),
      revision: message.revision,
      receivedAt: Date.now()
    };
    realtimeNodeCursors = {
      ...realtimeNodeCursors,
      [message.nodeId]: {
        ...realtimeNodeCursors[message.nodeId],
        [message.userId]: cursor
      }
    };
    realtimeCursorExpiry.set(
      key,
      setTimeout(() => {
        realtimeCursorExpiry.delete(key);
        removeRealtimeNodeCursor(message.nodeId as string, message.userId as string);
      }, 20_000)
    );
  }
  function receiveNodeDraft(message: {
    nodeId?: unknown;
    body?: unknown;
    revision?: unknown;
    userId?: unknown;
    userName?: unknown;
  }) {
    if (
      typeof message.nodeId !== 'string' ||
      !Array.isArray(message.body) ||
      typeof message.revision !== 'string' ||
      typeof message.userId !== 'string' ||
      typeof message.userName !== 'string' ||
      !snapshot.nodes.some((node) => node.id === message.nodeId)
    )
      return;
    const draft = {
      body: message.body as Paragraph[],
      revision: message.revision,
      userId: message.userId,
      userName: message.userName,
      receivedAt: Date.now()
    };
    realtimeNodeDrafts = { ...realtimeNodeDrafts, [message.nodeId]: draft };
    snapshot = {
      ...snapshot,
      nodes: snapshot.nodes.map((node) =>
        node.id === message.nodeId ? { ...node, description: normalizeBody(draft.body) } : node
      )
    };
  }
  function receiveSessionDraft(message: {
    sessionId?: unknown;
    body?: unknown;
    revision?: unknown;
    userId?: unknown;
    userName?: unknown;
  }) {
    if (
      typeof message.sessionId !== 'string' ||
      !Array.isArray(message.body) ||
      typeof message.revision !== 'string' ||
      typeof message.userId !== 'string' ||
      typeof message.userName !== 'string' ||
      !snapshot.sessions.some((session) => session.id === message.sessionId)
    )
      return;
    const draft = {
      body: message.body as Paragraph[],
      revision: message.revision,
      userId: message.userId,
      userName: message.userName,
      receivedAt: Date.now()
    };
    realtimeDrafts = { ...realtimeDrafts, [message.sessionId]: draft };
    snapshot = {
      ...snapshot,
      sessions: snapshot.sessions.map((session) =>
        session.id === message.sessionId ? { ...session, body: normalizeBody(draft.body) } : session
      )
    };
  }
  function mergeRealtimeDrafts(incoming: WorkspaceSnapshot): WorkspaceSnapshot {
    const remaining: typeof realtimeDrafts = {};
    const sessions = incoming.sessions.map((session) => {
      const draft = realtimeDrafts[session.id];
      if (!draft) return session;
      if (JSON.stringify(session.body) === JSON.stringify(draft.body)) return session;
      if (Date.now() - draft.receivedAt > 15_000) return session;
      remaining[session.id] = draft;
      return { ...session, body: normalizeBody(draft.body) };
    });
    realtimeDrafts = remaining;
    const remainingNodeDrafts: typeof realtimeNodeDrafts = {};
    const nodes = incoming.nodes.map((node) => {
      const draft = realtimeNodeDrafts[node.id];
      if (!draft) return node;
      if (JSON.stringify(node.description) === JSON.stringify(draft.body)) return node;
      if (Date.now() - draft.receivedAt > 15_000) return node;
      remainingNodeDrafts[node.id] = draft;
      return { ...node, description: normalizeBody(draft.body) };
    });
    realtimeNodeDrafts = remainingNodeDrafts;
    return { ...incoming, sessions, nodes };
  }
  async function refresh() {
    if (refreshing) {
      refreshQueued = true;
      return;
    }
    refreshing = true;
    try {
      do {
        refreshQueued = false;
        const query = snapshot.viewAs ? `?viewAs=${encodeURIComponent(snapshot.viewAs.id)}` : '';
        const incoming = await api<WorkspaceSnapshot>(
          `/api/campaigns/${snapshot.campaign.id}/workspace${query}`
        );
        const merged = mergeRealtimeDrafts(incoming);
        snapshot = merged;
        if (!forceSettingsDirty) forceSettings = { ...merged.campaign.forceSettings };
      } while (refreshQueued);
    } finally {
      refreshing = false;
    }
  }
  async function createNode(value: any) {
    const result = await api<{ id: string }>(`/api/campaigns/${snapshot.campaign.id}/nodes`, {
      method: 'POST',
      body: JSON.stringify(value)
    });
    await refresh();
    createState?.insert?.(result.id);
    selected = result.id;
    notify(t('graph.nodeAdded'));
    return result.id;
  }
  function mentionCreate(title: string, insert: (id: string) => void) {
    createState = { title, x: 0, y: 0, insert };
  }
  async function patchNode(id: string, value: Record<string, unknown>, reload = true) {
    const original = nodeMap.get(id);
    if (original) {
      const optimistic = { ...original, ...value } as WorldNode & { trashed?: boolean };
      if (value.trashed !== undefined) {
        optimistic.trashedAt = value.trashed ? new Date().toISOString() : null;
        delete optimistic.trashed;
      }
      snapshot = {
        ...snapshot,
        nodes: snapshot.nodes.map((node) => (node.id === id ? optimistic : node))
      };
    }
    try {
      const updated = await api<Record<string, unknown>>(
        `/api/campaigns/${snapshot.campaign.id}/nodes/${id}`,
        { method: 'PATCH', body: JSON.stringify(value) }
      );
      const current = nodeMap.get(id);
      if (current) {
        const { typeKey, ...fields } = updated;
        const confirmed = {
          ...current,
          ...fields,
          type: typeof typeKey === 'string' ? typeKey : current.type
        } as WorldNode;
        snapshot = {
          ...snapshot,
          nodes: snapshot.nodes.map((node) => (node.id === id ? confirmed : node))
        };
      }
      if (reload) await refresh();
    } catch (error) {
      if (original)
        snapshot = {
          ...snapshot,
          nodes: snapshot.nodes.map((node) => (node.id === id ? original : node))
        };
      throw error;
    }
  }
  async function connect(a: string, b: string) {
    const link = await api<{ id: string }>(`/api/campaigns/${snapshot.campaign.id}/links`, {
      method: 'POST',
      body: JSON.stringify({ sourceId: a, targetId: b })
    });
    await refresh();
    notify(t('workspace.linkAdded'), {
      label: t('common.undo'),
      run: async () => {
        await disconnect(link.id);
      }
    });
  }
  async function disconnect(id: string) {
    await api(`/api/campaigns/${snapshot.campaign.id}/links/${id}`, { method: 'DELETE' });
    await refresh();
    notify(t('workspace.linkRemoved'));
  }
  function showContext(x: number, y: number, items: MenuItem[]) {
    const available = items.filter(Boolean);
    if (!available.length) return;
    dismissPreview();
    popover = null;
    context = {
      x,
      y,
      items: [
        ...available.filter((item) => !item.danger),
        ...available.filter((item) => item.danger)
      ]
    };
  }
  function nodeMenuItems(node: WorldNode): MenuItem[] {
    return [
      { label: t('common.open'), icon: 'open', run: () => openNode(node.id) },
      ...(can('link')
        ? [
            {
              label: t('workspace.context.connect'),
              icon: 'link',
              run: () => (connectId = node.id)
            }
          ]
        : []),
      ...(view !== 'graph'
        ? [
            {
              label: t('workspace.context.showGraph'),
              icon: 'graph',
              run: () => {
                selected = node.id;
                navigateWorkspace({ view: 'graph', dossier: null });
                setTimeout(() => graph?.centerOn(node.id));
              }
            }
          ]
        : []),
      ...(node.pinX !== null && node.pinY !== null
        ? [
            {
              label: t('graph.showOnMap'),
              icon: 'atlas',
              run: () => {
                selected = node.id;
                navigateWorkspace({ view: 'atlas', dossier: null });
              }
            }
          ]
        : []),
      ...(can('reveal')
        ? [
            {
              label: node.revealed ? t('graph.hide') : t('graph.reveal'),
              icon: node.revealed ? 'eye-off' : 'eye',
              run: () => patchNode(node.id, { revealed: !node.revealed })
            }
          ]
        : []),
      ...(can('delete')
        ? [
            {
              label: t('workspace.context.trash'),
              icon: 'trash',
              danger: true,
              run: async () => {
                if (dossier === node.id) navigateWorkspace({ dossier: null }, true);
                if (selected === node.id) selected = null;
                if (popover === node.id) popover = null;
                await patchNode(node.id, { trashed: true });
              }
            }
          ]
        : [])
    ];
  }
  function showNodeContext(id: string, x: number, y: number, extras: MenuItem[] = []) {
    const node = nodeMap.get(id);
    if (node && !node.trashedAt) showContext(x, y, [...nodeMenuItems(node), ...extras]);
  }
  function graphContext(
    id: string | null,
    clientX: number,
    clientY: number,
    worldX: number,
    worldY: number
  ) {
    if (id) {
      selected = id;
      showNodeContext(id, clientX, clientY);
      return;
    }
    showContext(clientX, clientY, [
      ...(can('create')
        ? [
            {
              label: t('workspace.context.newHere'),
              icon: 'plus',
              run: () => (createState = { title: '', x: worldX, y: worldY })
            }
          ]
        : []),
      { label: t('graph.fit'), icon: 'fit', run: () => graph?.fitView() },
      { label: t('graph.reflow'), icon: 'shuffle', run: () => graph?.reflow() }
    ]);
  }
  async function upload(file: File, purpose: 'image' | 'map') {
    const form = new FormData();
    form.set('campaignId', snapshot.campaign.id);
    form.set('purpose', purpose);
    form.set('file', file);
    const asset = await api<MediaAsset>('/api/media', { method: 'POST', body: form });
    snapshot.media = [...snapshot.media, asset];
    return asset;
  }
  async function uploadMain(file: File) {
    const asset = await upload(file, 'map');
    await api(`/api/campaigns/${snapshot.campaign.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ mapMediaId: asset.id })
    });
    await refresh();
  }
  async function createSession() {
    const result = await api<{ id: string }>(`/api/campaigns/${snapshot.campaign.id}/sessions`, {
      method: 'POST',
      body: JSON.stringify({
        title:
          newSessionTitle || t('session.defaultTitle', { number: snapshot.sessions.length + 1 }),
        worldDate: newSessionDate
      })
    });
    sessionCreate = false;
    newSessionTitle = '';
    newSessionDate = '';
    await refresh();
    navigateWorkspace({
      view: 'session',
      sessionId: result.id,
      sessionEditing: true,
      dossier: null
    });
  }
  async function saveCampaign(value: Record<string, unknown>) {
    await api(`/api/campaigns/${snapshot.campaign.id}`, {
      method: 'PATCH',
      body: JSON.stringify(value)
    });
    await refresh();
  }
  async function addNodeType(value: {
    key: string;
    pluralName: string;
    singularName: string;
    colorDark: string;
    colorLight: string;
  }) {
    await api(`/api/campaigns/${snapshot.campaign.id}/types`, {
      method: 'POST',
      body: JSON.stringify(value)
    });
    await refresh();
    notify(t('node.typeAdded', { name: value.pluralName }));
  }
  async function removeNodeType(key: string) {
    await api(`/api/campaigns/${snapshot.campaign.id}/types/${encodeURIComponent(key)}`, {
      method: 'DELETE'
    });
    await refresh();
    notify(t('node.typeRemoved'));
  }
  async function changeView(userId: string | null) {
    const query = userId ? `?viewAs=${encodeURIComponent(userId)}` : '';
    snapshot = await api(`/api/campaigns/${snapshot.campaign.id}/workspace${query}`);
    selected = null;
    popover = null;
    dossier = null;
    nodeTab = 'overview';
    context = null;
    const url = new URL(location.href);
    if (userId) url.searchParams.set('viewAs', userId);
    else url.searchParams.delete('viewAs');
    url.searchParams.delete('node');
    url.searchParams.delete('nodeTab');
    replaceState(url, {});
    notify(
      userId
        ? t('workspace.readonlyAs', { name: snapshot.viewAs?.name ?? '' })
        : t('workspace.gmView')
    );
  }
  async function loadVersions() {
    const result = await api<{ versions: any[] }>(
      `/api/campaigns/${snapshot.campaign.id}/versions?type=${history!.type}&entityId=${history!.id}`
    );
    return result.versions.map((version) => ({
      ...version,
      createdAt: new Date(version.createdAt).toISOString()
    })) as VersionEntry[];
  }
</script>

<svelte:head><title>{snapshot.campaign.title} · Atlore</title></svelte:head>
<main class="workspace" data-realtime={realtimeStatus}>
  <WorkspaceHeader
    campaign={snapshot.campaign}
    {panelOpen}
    togglePanel={() => (panelOpen = !panelOpen)}
    exit={() => goto('/campaigns')}
  />
  <div class="workspace-body">
    <NavigationRail
      {view}
      pick={(next) => {
        navigateWorkspace({ view: next, sessionEditing: false, dossier: null });
      }}
    /><ExplorerPanel
      open={panelOpen}
      {panel}
      nodes={snapshot.nodes}
      sessions={snapshot.sessions}
      types={snapshot.nodeTypes}
      {recent}
      {selected}
      settings={forceSettings}
      {forceStatus}
      {theme}
      members={snapshot.members}
      viewAs={snapshot.viewAs}
      canViewAs={snapshot.canViewAs}
      canCreate={can('create')}
      canManage={can('settings')}
      canPurge={snapshot.campaign.role === 'gm'}
      onPanel={(next) => navigateWorkspace({ panel: next })}
      onNode={explorerSelect}
      onContext={showNodeContext}
      onNew={() => (createState = { title: '', x: 0, y: 0 })}
      onRestore={(id) => patchNode(id, { trashed: false })}
      onPurge={async (id) => {
        await api(`/api/campaigns/${snapshot.campaign.id}/nodes/${id}`, { method: 'DELETE' });
        await refresh();
      }}
      onRestoreSession={async (id) => {
        await api(`/api/campaigns/${snapshot.campaign.id}/sessions/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ trashed: false })
        });
        await refresh();
        sessionId ||= id;
      }}
      onPurgeSession={async (id) => {
        await api(`/api/campaigns/${snapshot.campaign.id}/sessions/${id}`, { method: 'DELETE' });
        await refresh();
      }}
      onAddType={addNodeType}
      onRemoveType={removeNodeType}
      onForceSettings={changeForceSettings}
      onForceSettingsCommit={() => void persistForceSettings.flush()}
      onCampaignSettings={() => navigateWorkspace({ campaignSettings: 'general' })}
      onReflow={() => graph?.reflow()}
      onTheme={toggleTheme}
      onViewAs={changeView}
      onClose={() => (panelOpen = false)}
    />
    <section class="stage">
      {#if view === 'graph'}<GraphCanvas
          bind:this={graph}
          nodes={snapshot.nodes}
          links={snapshot.links}
          types={snapshot.nodeTypes}
          {theme}
          {selected}
          settings={forceSettings}
          onSelect={graphSelect}
          onOpen={openNode}
          onCreate={(x, y) => {
            if (can('create')) createState = { title: '', x, y };
          }}
          onContext={graphContext}
          onMove={(id, x, y) => {
            if (can('edit')) patchNode(id, { x, y }, false);
          }}
        /><GraphToolbar
          fit={() => graph?.fitView()}
          reflow={() => graph?.reflow()}
          newNode={() => (createState = { title: '', x: 0, y: 0 })}
          canCreate={can('create')}
        />{#if !hasActiveNodes}<div class="graph-empty">
            <EmptyState
              icon="graph"
              heading={t(can('create') ? 'graph.emptyHeading' : 'graph.emptyReadOnlyHeading')}
              text={can('create') ? t('graph.emptyText') : t('graph.emptyReadOnlyText')}
              actionLabel={can('create') ? t('graph.emptyAction') : ''}
              action={can('create') ? () => (createState = { title: '', x: 0, y: 0 }) : undefined}
              testId="graph-empty-state"
            />
          </div>{/if}{#if popoverNode}<NodePopover
            node={popoverNode}
            type={typeMap.get(popoverNode.type)}
            media={snapshot.media}
            anchor={popoverAnchor}
            open={() => openNode(popoverNode.id)}
            connect={() => (connectId = popoverNode.id)}
            showAtlas={() => {
              navigateWorkspace({ view: 'atlas', dossier: null });
            }}
            toggleReveal={() => patchNode(popoverNode.id, { revealed: !popoverNode.revealed })}
            close={() => (popover = null)}
            canLink={can('link')}
            canReveal={can('reveal')}
          />{/if}
      {:else if view === 'session'}<StoryView
          sessions={snapshot.sessions}
          scratch={snapshot.scratch}
          nodes={snapshot.nodes}
          types={snapshot.nodeTypes}
          currentUserName={snapshot.currentUser.name}
          editingSessionId={sessionEditing ? sessionId : null}
          liveBodies={Object.fromEntries(
            Object.entries(realtimeDrafts).map(([id, draft]) => [id, draft.body])
          )}
          liveUsers={Object.fromEntries(
            Object.entries(realtimeDrafts).map(([id, draft]) => [id, draft.userName])
          )}
          liveCursors={Object.fromEntries(
            Object.entries(realtimeCursors).map(([id, cursors]) => [id, Object.values(cursors)])
          )}
          canWrite={can('write')}
          canStart={can('session')}
          canHistory={can('history')}
          canDelete={can('delete')}
          {openNode}
          {previewNode}
          createMention={mentionCreate}
          editSession={(id) => {
            navigateWorkspace({
              view: 'session',
              sessionId: id,
              sessionEditing: true,
              dossier: null
            });
          }}
          closeEditor={() => navigateWorkspace({ sessionEditing: false })}
          createSession={() => (sessionCreate = true)}
          save={async (sessionId, value, keepalive = false) => {
            const url = `/api/campaigns/${snapshot.campaign.id}/sessions/${sessionId}`;
            if (
              keepalive &&
              navigator.sendBeacon(
                url,
                new Blob([JSON.stringify(value)], { type: 'application/json' })
              )
            )
              return;
            const updated = await api<SessionEntry>(url, {
              method: 'PATCH',
              body: JSON.stringify(value),
              keepalive
            });
            const { [sessionId]: _persistedDraft, ...remainingDrafts } = realtimeDrafts;
            realtimeDrafts = remainingDrafts;
            snapshot = {
              ...snapshot,
              sessions: snapshot.sessions.map((item) => (item.id === updated.id ? updated : item))
            };
          }}
          saveScratch={async (sessionId, body, keepalive = false) => {
            const url = `/api/campaigns/${snapshot.campaign.id}/sessions/${sessionId}/scratch`;
            const payload = { body };
            if (
              keepalive &&
              navigator.sendBeacon(
                url,
                new Blob([JSON.stringify(payload)], { type: 'application/json' })
              )
            )
              return;
            await api(url, {
              method: 'PUT',
              body: JSON.stringify(payload),
              keepalive
            });
            snapshot = {
              ...snapshot,
              scratch: [
                ...snapshot.scratch.filter(
                  (item) => item.sessionId !== sessionId || item.userId !== snapshot.currentUser.id
                ),
                { sessionId, userId: snapshot.currentUser.id, body }
              ]
            };
          }}
          onLiveBody={broadcastSessionBody}
          onLiveCursor={broadcastSessionCursor}
          history={(session) => {
            history = {
              type: 'session',
              id: session.id,
              title: session.title,
              body: session.body
            };
          }}
          trash={async (session) => {
            await api(`/api/campaigns/${snapshot.campaign.id}/sessions/${session.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ trashed: true })
            });
            await refresh();
            navigateWorkspace(
              {
                sessionId: snapshot.sessions.find((item) => !item.trashedAt)?.id ?? '',
                sessionEditing: false,
                dossier: null
              },
              true
            );
          }}
          {showContext}
          {showNodeContext}
        />
      {:else}<AtlasMap
          campaign={snapshot.campaign}
          nodes={snapshot.nodes}
          types={snapshot.nodeTypes}
          media={snapshot.media}
          canUpload={can('mapUpload')}
          canPin={can('pin')}
          {uploadMain}
          pinNode={patchNode}
          {openNode}
          {previewNode}
          {dismissPreview}
          {showNodeContext}
        />{/if}
      {#if dossierNode}{#key dossierNode.id}<NodeDossier
            node={dossierNode}
            nodes={snapshot.nodes}
            links={snapshot.links}
            sessions={snapshot.sessions}
            types={snapshot.nodeTypes}
            members={snapshot.members}
            media={snapshot.media}
            currentUserId={snapshot.currentUser.id}
            liveBody={realtimeNodeDrafts[dossierNode.id]?.body}
            liveUser={realtimeNodeDrafts[dossierNode.id]?.userName}
            liveCursors={Object.values(realtimeNodeCursors[dossierNode.id] ?? {})}
            tab={nodeTab}
            onTab={(next) => navigateWorkspace({ nodeTab: next })}
            canEdit={can('edit')}
            canWrite={can('write')}
            canImage={can('image')}
            canReveal={can('reveal')}
            canLink={can('link')}
            canHistory={can('history')}
            close={() => navigateWorkspace({ dossier: null })}
            {openNode}
            {previewNode}
            openSession={(id) => {
              navigateWorkspace({
                view: 'session',
                sessionId: id,
                sessionEditing: false,
                dossier: null
              });
            }}
            saveNode={(value) => patchNode(dossierNode.id, value)}
            saveDescription={async (body) => {
              await api(
                `/api/campaigns/${snapshot.campaign.id}/nodes/${dossierNode.id}/description`,
                { method: 'PUT', body: JSON.stringify({ body }) }
              );
              await refresh();
            }}
            saveNote={async (body) => {
              await api(`/api/campaigns/${snapshot.campaign.id}/nodes/${dossierNode.id}/note`, {
                method: 'PUT',
                body: JSON.stringify({ body })
              });
              snapshot = {
                ...snapshot,
                nodes: snapshot.nodes.map((node) =>
                  node.id === dossierNode.id ? { ...node, note: normalizeBody(body) } : node
                )
              };
            }}
            onLiveBody={broadcastNodeDescription}
            onLiveCursor={broadcastNodeCursor}
            connect={(id) => connect(dossierNode.id, id)}
            {disconnect}
            {upload}
            showHistory={() =>
              (history = {
                type: 'node',
                id: dossierNode.id,
                title: dossierNode.title,
                body: dossierNode.description
              })}
            createMention={mentionCreate}
            {showContext}
            {showNodeContext}
          />{/key}{/if}
    </section>
  </div>
</main>
{#if previewNodeEntry && !popoverNode && !dossierNode}<NodePreview
    node={previewNodeEntry}
    type={typeMap.get(previewNodeEntry.type)}
    media={snapshot.media}
    anchor={previewAnchor}
    open={() => openNode(previewNodeEntry!.id)}
    keep={keepPreview}
    leave={() => previewNode(null)}
  />{/if}
{#if createState}<CreateNodeModal
    initialTitle={createState.title}
    initialX={createState.x}
    initialY={createState.y}
    nodes={snapshot.nodes}
    types={snapshot.nodeTypes}
    members={snapshot.members}
    close={() => (createState = null)}
    create={createNode}
  />{/if}
{#if connectId && nodeMap.get(connectId)}<ConnectionModal
    node={nodeMap.get(connectId)!}
    nodes={snapshot.nodes}
    links={snapshot.links}
    types={snapshot.nodeTypes}
    close={() => (connectId = null)}
    connect={(id) => connect(connectId!, id)}
  />{/if}
{#if palette}<SearchPalette
    nodes={snapshot.nodes}
    types={snapshot.nodeTypes}
    close={() => (palette = false)}
    open={openNode}
  />{/if}
{#if context}<ContextMenu
    x={context.x}
    y={context.y}
    items={context.items}
    close={() => (context = null)}
  />{/if}
{#if campaignSettings}<CampaignSettingsModal
    {snapshot}
    tab={campaignSettings}
    onTab={(next) => navigateWorkspace({ campaignSettings: next })}
    close={() => navigateWorkspace({ campaignSettings: null })}
    save={saveCampaign}
    invite={async (value) => {
      await api(`/api/campaigns/${snapshot.campaign.id}/invite`, {
        method: 'POST',
        body: JSON.stringify(value)
      });
      await refresh();
    }}
    roleChange={async (id, role) => {
      await api(`/api/campaigns/${snapshot.campaign.id}/members/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ role })
      });
      await refresh();
    }}
    remove={async (id) => {
      await api(`/api/campaigns/${snapshot.campaign.id}/members/${id}`, { method: 'DELETE' });
      await refresh();
    }}
    destroy={async () => {
      await api(`/api/campaigns/${snapshot.campaign.id}`, { method: 'DELETE' });
      await goto('/campaigns');
    }}
  />{/if}
{#if sessionCreate}<Modal
    title={t('session.newTitle')}
    eyebrow={t('session.newEyebrow')}
    close={() => (sessionCreate = false)}
    ><form
      class="session-form"
      onsubmit={(event) => {
        event.preventDefault();
        createSession();
      }}
    >
      <input
        class="field serif-input"
        bind:value={newSessionTitle}
        placeholder={t('session.titlePlaceholder', { number: snapshot.sessions.length + 1 })}
        required
      /><input class="field" bind:value={newSessionDate} placeholder={t('session.worldDate')} />
      <div>
        <button type="button" class="ghost-button" onclick={() => (sessionCreate = false)}
          >{t('common.cancel')}</button
        ><button class="primary-button">{t('session.start')}</button>
      </div>
    </form></Modal
  >{/if}
{#if history}<HistoryModal
    title={history.title}
    currentBody={history.body}
    nodes={snapshot.nodes}
    close={() => (history = null)}
    load={loadVersions}
    restore={async (id) => {
      await api(`/api/campaigns/${snapshot.campaign.id}/versions`, {
        method: 'POST',
        body: JSON.stringify({ versionId: id })
      });
      await refresh();
    }}
  />{/if}
<ToastStack {toasts} dismiss={(id) => (toasts = toasts.filter((item) => item.id !== id))} />

<style>
  .workspace {
    --mobile-navigation-height: 54px;
    height: 100dvh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--canvas);
    color: var(--text);
    user-select: none;
  }
  .workspace-body {
    flex: 1;
    display: flex;
    min-height: 0;
  }
  .stage {
    position: relative;
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }
  .graph-empty {
    position: absolute;
    z-index: 4;
    inset: 0;
    display: grid;
    place-items: center;
    pointer-events: none;
  }
  .graph-empty :global(.empty-state) {
    pointer-events: auto;
  }
  .session-form {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .session-form .serif-input {
    font: 19px var(--font-serif);
  }
  .session-form > div {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    margin-top: 6px;
  }
  @media (max-width: 859px) {
    .stage {
      padding-bottom: calc(var(--mobile-navigation-height) + env(safe-area-inset-bottom));
    }
  }
</style>
