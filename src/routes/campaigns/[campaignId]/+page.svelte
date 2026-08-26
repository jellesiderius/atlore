<script lang="ts">
  import { goto, pushState, replaceState } from '$app/navigation';
  import { onMount } from 'svelte';
  import CampaignSettingsModal from '$lib/components/campaign/CampaignSettingsModal.svelte';
  import GraphCanvas, { type ForceSettings } from '$lib/components/graph/GraphCanvas.svelte';
  import GraphToolbar from '$lib/components/graph/GraphToolbar.svelte';
  import NodePopover from '$lib/components/graph/NodePopover.svelte';
  import NodePreview from '$lib/components/graph/NodePreview.svelte';
  import AtlasMap from '$lib/components/map/AtlasMap.svelte';
  import ConnectionModal from '$lib/components/node/ConnectionModal.svelte';
  import CreateNodeModal from '$lib/components/node/CreateNodeModal.svelte';
  import NodeDossier from '$lib/components/node/NodeDossier.svelte';
  import SessionEditor from '$lib/components/session/SessionEditor.svelte';
  import StoryView from '$lib/components/session/StoryView.svelte';
  import ContextMenu, { type MenuItem } from '$lib/components/ui/ContextMenu.svelte';
  import HistoryModal from '$lib/components/workspace/HistoryModal.svelte';
  import SearchPalette from '$lib/components/workspace/SearchPalette.svelte';
  import ExplorerPanel from '$lib/components/workspace/ExplorerPanel.svelte';
  import NavigationRail from '$lib/components/workspace/NavigationRail.svelte';
  import WorkspaceHeader from '$lib/components/workspace/WorkspaceHeader.svelte';
  import Modal from '$lib/components/ui/Modal.svelte';
  import ToastStack, { type Toast } from '$lib/components/ui/ToastStack.svelte';
  import { api } from '$lib/client/api';
  import { createClientId } from '$lib/client/id';
  import { may } from '$lib/domain/permissions';
  import { t } from '$lib/i18n/index.svelte';
  import type {
    MediaAsset,
    CampaignSettingsTab,
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
  let forceSettings = $state<ForceSettings>({
    repel: 700,
    distance: 70,
    grouping: 0.65,
    gravity: 0.3
  });
  let toasts = $state<Toast[]>([]);
  let refreshing = false;
  let refreshQueued = false;
  let nodeMap = $derived(new Map(snapshot.nodes.map((node) => [node.id, node])));
  let popoverNode = $derived(popover ? nodeMap.get(popover) : undefined);
  let previewNodeEntry = $derived(previewId ? nodeMap.get(previewId) : undefined);
  let dossierNode = $derived(dossier ? nodeMap.get(dossier) : undefined);
  let currentSession = $derived(
    snapshot.sessions.find((session) => session.id === sessionId) ?? null
  );
  let scratch = $derived(
    currentSession
      ? snapshot.scratch.find((item) => item.sessionId === currentSession.id)
      : undefined
  );
  let typeMap = $derived(new Map(snapshot.nodeTypes.map((type) => [type.key, type])));
  const workspaceViews = new Set<ViewName>(['graph', 'session', 'story', 'atlas']);
  const workspacePanels = new Set<PanelName>(['explorer', 'recent', 'search', 'settings']);
  const dossierTabs = new Set<NodeDossierTab>(['overview', 'map', 'game', 'relations', 'story']);
  const campaignSettingsTabs = new Set<CampaignSettingsTab>(['general', 'members', 'rights']);
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
    let realtime: WebSocket | null = null;
    let realtimeTimer: ReturnType<typeof setTimeout>;
    let realtimeConnecting = false;
    let suspended = false;
    let disposed = false;
    const connectRealtime = () => {
      suspended = false;
      if (disposed || realtimeConnecting || realtime) return;
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
          socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.type === 'invalidate') {
              clearTimeout(realtimeTimer);
              realtimeTimer = setTimeout(refresh, 180);
            }
          };
          socket.onclose = () => {
            if (realtime === socket) realtime = null;
          };
        })
        .catch(() => undefined)
        .finally(() => (realtimeConnecting = false));
    };
    const suspendRealtime = () => {
      suspended = true;
      clearTimeout(realtimeTimer);
      realtime?.close();
      realtime = null;
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
    window.addEventListener('pagehide', suspendRealtime);
    restore();
    connectRealtime();
    return () => {
      disposed = true;
      window.removeEventListener('keydown', key);
      window.removeEventListener('popstate', restore);
      window.removeEventListener('pageshow', restoreFromCache);
      window.removeEventListener('pagehide', suspendRealtime);
      clearTimeout(previewShowTimer);
      clearTimeout(previewHideTimer);
      suspendRealtime();
    };
  });
  function can(right: Parameters<typeof may>[2]) {
    return !snapshot.viewAs && may(snapshot.campaign.role, snapshot.campaign.rights, right);
  }
  function applyTheme() {
    document.documentElement.dataset.theme = theme;
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
    const requestedView = url.searchParams.get('view') as ViewName | null;
    view = requestedView && workspaceViews.has(requestedView) ? requestedView : 'graph';
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
      dossier?: string | null;
      nodeTab?: NodeDossierTab;
      campaignSettings?: CampaignSettingsTab | null;
    },
    replace = false
  ) {
    if (next.view) view = next.view;
    if (next.panel) panel = next.panel;
    if (next.sessionId !== undefined) sessionId = next.sessionId;
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
    if (matchMedia('(hover: none)').matches || popover || dossier) return;
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
        snapshot = await api(`/api/campaigns/${snapshot.campaign.id}/workspace${query}`);
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
    navigateWorkspace({ view: 'session', sessionId: result.id, dossier: null });
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
<main class="workspace">
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
        navigateWorkspace({ view: next, dossier: null });
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
      {theme}
      members={snapshot.members}
      viewAs={snapshot.viewAs}
      canViewAs={snapshot.canViewAs}
      canCreate={can('create')}
      canManage={can('settings')}
      canPurge={snapshot.campaign.role === 'gm'}
      onPanel={(next) => navigateWorkspace({ panel: next })}
      onNode={explorerSelect}
      onPreview={previewNode}
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
      onForceSettings={(value) => (forceSettings = value)}
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
        />{#if popoverNode}<NodePopover
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
      {:else if view === 'session'}{#key currentSession?.id}<SessionEditor
            session={currentSession}
            sessions={snapshot.sessions}
            {scratch}
            nodes={snapshot.nodes}
            links={snapshot.links}
            types={snapshot.nodeTypes}
            posts={snapshot.posts}
            currentUserName={snapshot.currentUser.name}
            canWrite={can('write')}
            canStart={can('session')}
            canHistory={can('history')}
            canDelete={can('delete')}
            canLink={can('link')}
            {openNode}
            {previewNode}
            createMention={mentionCreate}
            pick={(id) => navigateWorkspace({ view: 'session', sessionId: id, dossier: null })}
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
                    (item) =>
                      item.sessionId !== sessionId || item.userId !== snapshot.currentUser.id
                  ),
                  { sessionId, userId: snapshot.currentUser.id, body }
                ]
              };
            }}
            createSession={() => (sessionCreate = true)}
            trash={async () => {
              if (currentSession) {
                await api(`/api/campaigns/${snapshot.campaign.id}/sessions/${currentSession.id}`, {
                  method: 'PATCH',
                  body: JSON.stringify({ trashed: true })
                });
                await refresh();
                navigateWorkspace(
                  {
                    view: 'session',
                    sessionId: snapshot.sessions.find((item) => !item.trashedAt)?.id ?? '',
                    dossier: null
                  },
                  true
                );
              }
            }}
            history={() => {
              if (currentSession)
                history = {
                  type: 'session',
                  id: currentSession.id,
                  title: currentSession.title,
                  body: currentSession.body
                };
            }}
            {connect}
            {showContext}
            {showNodeContext}
          />{/key}
      {:else if view === 'story'}<StoryView
          sessions={snapshot.sessions}
          scratch={snapshot.scratch}
          nodes={snapshot.nodes}
          types={snapshot.nodeTypes}
          currentUserName={snapshot.currentUser.name}
          {openNode}
          {previewNode}
          openSession={(id) => {
            navigateWorkspace({ view: 'session', sessionId: id, dossier: null });
          }}
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
          {showNodeContext}
        />{/if}
      {#if dossierNode}{#key dossierNode.id}<NodeDossier
            node={dossierNode}
            nodes={snapshot.nodes}
            links={snapshot.links}
            sessions={snapshot.sessions}
            types={snapshot.nodeTypes}
            members={snapshot.members}
            posts={snapshot.posts}
            media={snapshot.media}
            currentUserId={snapshot.currentUser.id}
            tab={nodeTab}
            onTab={(next) => navigateWorkspace({ nodeTab: next })}
            canEdit={can('edit')}
            canImage={can('image')}
            canReveal={can('reveal')}
            canLink={can('link')}
            canHistory={can('history')}
            close={() => navigateWorkspace({ dossier: null })}
            {openNode}
            {previewNode}
            openSession={(id) => {
              navigateWorkspace({ view: 'session', sessionId: id, dossier: null });
            }}
            saveNode={(value) => patchNode(dossierNode.id, value)}
            saveDescription={async (body, shared) => {
              await api(
                `/api/campaigns/${snapshot.campaign.id}/nodes/${dossierNode.id}/description`,
                { method: 'PUT', body: JSON.stringify({ body, shared }) }
              );
            }}
            connect={(id) => connect(dossierNode.id, id)}
            {disconnect}
            addPost={async (value) => {
              await api(`/api/campaigns/${snapshot.campaign.id}/posts`, {
                method: 'POST',
                body: JSON.stringify(value)
              });
              await refresh();
            }}
            {upload}
            showHistory={() =>
              (history = {
                type: 'node',
                id: dossierNode.id,
                title: dossierNode.title,
                body: dossierNode.descriptions.find((item) => item.own)?.body ?? []
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
      padding-bottom: calc(58px + env(safe-area-inset-bottom));
    }
  }
</style>
