// ==================== Tauri API ====================
const { invoke } = window.__TAURI__.core;
const { getCurrentWindow, LogicalSize, PhysicalPosition, currentMonitor } = window.__TAURI__.window;
const { listen } = window.__TAURI__.event;
const win = getCurrentWindow();

// ==================== DOM refs ====================
const appEl = document.getElementById('appWindow');
const collapsedBar = document.getElementById('collapsedBar');
const windowToolbar = document.getElementById('windowToolbar');
const collapsedTitle = document.getElementById('collapsedTitle');
const collapsedHideButton = document.getElementById('collapsedHideButton');
const hideButton = document.getElementById('hideButton');
const copyCurrentButton = document.getElementById('copyCurrentButton');
const topmostButton = document.getElementById('topmostButton');
const topmostSwitch = document.getElementById('topmostSwitch');
const autostartSwitch = document.getElementById('autostartSwitch');
const hotkeySwitch = document.getElementById('hotkeySwitch');
const autoSaveSwitch = document.getElementById('autoSaveSwitch');
const transparentSwitch = document.getElementById('transparentSwitch');
const settingsButton = document.getElementById('settingsButton');
const settingsPopover = document.getElementById('settingsPopover');
const searchInput = document.getElementById('searchInput');
const draftList = document.getElementById('draftList');
const addButton = document.getElementById('addButton');
const titleInput = document.getElementById('titleInput');
const editor = document.getElementById('editor');
const saveStatus = document.getElementById('saveStatus');
const contextMenu = document.getElementById('contextMenu');
const windowContextMenu = document.getElementById('windowContextMenu');
const windowTopmostLabel = document.getElementById('windowTopmostLabel');
const windowTopmostCheck = document.getElementById('windowTopmostCheck');
const modalLayer = document.getElementById('modalLayer');
const deleteText = document.getElementById('deleteText');
const toast = document.getElementById('toast');
const toastText = document.getElementById('toastText');
const conflictBanner = document.getElementById('conflictBanner');
const pinActionLabel = document.getElementById('pinActionLabel');
const expandedShell = document.querySelector('.expanded-shell');
const storePathDisplay = document.getElementById('storePathDisplay');

// ==================== state ====================
let drafts = [];
let activeId = null;
let contextId = null;
let draggedId = null;
let saveTimer = null;
let toastTimer = null;
let previewCloseTimer = null;
let previewSide = 'right';
let alwaysOnTop = false;
let settings = {
  always_on_top: false,
  autostart: false,
  hotkey: true,
  auto_save: true,
  transparent: false,
  store_dir: '',
  pinned: [],
};

const WINDOW_SIZE = {
  collapsed: { w: 248, h: 36 },
  expanded: { w: 248, h: 480 },
  preview: { w: 1192, h: 480 },
};
const DIR_W = 248;      // 目录宽（逻辑）
const DIR_CENTER = 472; // 目录在 1192 轨道窗口中的左侧偏移（= 编辑区宽）
const EDIT_W = 472;     // 编辑区宽（逻辑）

// ==================== helpers ====================
function iconUse(id) { return `<svg><use href="#${id}"/></svg>`; }
function activeDraft() { return drafts.find(d => d.id === activeId) || drafts[0] || null; }
function isPreviewOpen() { return expandedShell.classList.contains('preview-open'); }
function pad(n) { return String(n).padStart(2, '0'); }
function formatTime(ms) {
  const d = new Date(ms);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return '昨天';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }

// ==================== window sizing ====================
async function resizeWindow() {
  const preview = isPreviewOpen();
  const expanded = appEl.classList.contains('expanded');
  const size = preview ? WINDOW_SIZE.preview : (expanded ? WINDOW_SIZE.expanded : WINDOW_SIZE.collapsed);
  const monitor = await currentMonitor();
  const scale = monitor ? monitor.scaleFactor : 1;
  const pos = await win.outerPosition();
  const curW = (await win.outerSize()).width;
  // 转换前目录屏幕左缘：窗口已是 1192 宽则目录居中（DIR_CENTER），否则目录在窗口左缘
  const isWide = curW > WINDOW_SIZE.expanded.w * scale + 1;
  const dirScreenLeft = isWide ? pos.x + DIR_CENTER * scale : pos.x;
  await win.setSize(new LogicalSize(size.w, size.h));
  const newX = preview ? dirScreenLeft - DIR_CENTER * scale : dirScreenLeft;
  if (newX !== pos.x) await win.setPosition(new PhysicalPosition(newX, pos.y));
}

// 交换方向：目录不动，只切换编辑区 CSS transform（窗口不移动）
async function applyPreviewSide(side) {
  previewSide = side;
  appEl.classList.toggle('preview-left', side === 'left');
  appEl.classList.toggle('preview-right', side === 'right');
}

// 手动窗口拖拽：按住移动超过阈值才进入系统拖拽，快速双击保留 dblclick 展开/折叠
function setupWindowDrag(handle) {
  let press = false;
  let moved = false;
  let startX = 0;
  let startY = 0;

  const startDrag = () => {
    press = false;
    moved = true;
    win.startDragging().catch(() => {});
  };

  handle.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button,input')) return;
    press = true;
    moved = false;
    startX = e.clientX;
    startY = e.clientY;
  });
  handle.addEventListener('pointermove', (e) => {
    if (!press || moved) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (dx * dx + dy * dy > 25) startDrag();
  });
  const endPress = () => { press = false; };
  window.addEventListener('pointerup', endPress);
  handle.addEventListener('pointercancel', endPress);
}
setupWindowDrag(dragZone);
setupWindowDrag(windowToolbar);

// ==================== drafts data ====================
async function reloadDrafts() {
  const list = await invoke('list_drafts');
  const pinnedSet = new Set(settings.pinned);
  drafts = list.map(m => ({
    id: m.path,
    path: m.path,
    title: m.title,
    content: '',
    mtime: m.mtime,
    pinned: pinnedSet.has(m.path),
    loaded: false,
  }));
  if (!activeId || !drafts.some(d => d.id === activeId)) {
    activeId = drafts[0]?.id || null;
    if (activeId) await selectDraft(activeId);
    else { titleInput.value = ''; editor.value = ''; }
  }
  renderList();
}

async function selectDraft(id) {
  flushSave();
  activeId = id;
  const draft = activeDraft();
  if (!draft) return;
  if (!draft.loaded) {
    draft.content = await invoke('read_draft', { path: draft.path });
    draft.loaded = true;
  }
  titleInput.value = draft.title;
  editor.value = draft.content;
  saveStatus.textContent = '已保存';
  saveStatus.className = 'save-status';
  conflictBanner.classList.remove('show');
  renderList();
}

function renderList(query = searchInput.value) {
  const q = query.trim().toLowerCase();
  const filtered = drafts.filter(d => `${d.title}\n${d.content}`.toLowerCase().includes(q));
  collapsedTitle.textContent = '拾笺';
  if (!filtered.length) {
    draftList.innerHTML = `<div class="empty-list"><span class="empty-icon">${iconUse('i-note')}</span><strong>${drafts.length ? '没有搜索结果' : '没有草稿'}</strong><span>${drafts.length ? '尝试使用其他关键词' : '按 ＋ 新建'}</span></div>`;
    return;
  }
  const pinned = filtered.filter(d => d.pinned);
  const recent = filtered.filter(d => !d.pinned);
  const ordered = [...pinned, ...recent];
  const row = d => `<button class="draft-row ${d.id === activeId ? 'selected' : ''}">
    <span class="pin-slot ${d.pinned ? '' : 'empty'}">${iconUse('i-pin')}</span>
    <span class="draft-name">${escapeHtml(d.title)}</span><span class="draft-time">${formatTime(d.mtime)}</span>
    <span class="draft-preview">${escapeHtml((d.content || '').replace(/\n/g, ' ') || '空白草稿')}</span>
  </button>`;
  draftList.innerHTML = ordered.map(row).join('');
  rowDraftMap.clear();
  draftList.querySelectorAll('.draft-row').forEach((el, i) => {
    const d = ordered[i];
    if (!d) return;
    rowDraftMap.set(el, d);
    el.addEventListener('click', () => {
      if (isPreviewOpen() && activeId === d.id) closePreview();
      else openPreview(d.id);
    });
    el.addEventListener('contextmenu', event => openContextMenu(event, d.id));
  });
}

function reorderDraft(sourcePath, targetPath) {
  const si = drafts.findIndex(d => d.id === sourcePath);
  const ti = drafts.findIndex(d => d.id === targetPath);
  if (si < 0 || ti < 0 || si === ti) return;
  const before = si < ti;
  const [source] = drafts.splice(si, 1);
  const tIdx = drafts.findIndex(d => d.id === targetPath);
  drafts.splice(tIdx + (before ? 1 : 0), 0, source);
  renderList();
  showToast('已更新顺序');
}

// 草稿行拖拽重排（pointer 事件实现，WebView2 里 HTML5 drag 不可靠）
const rowDraftMap = new Map();
let reorderState = null;

function enableRowReorder() {
  draftList.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const row = e.target.closest('.draft-row');
    if (!row) return;
    const d = rowDraftMap.get(row);
    if (!d) return;
    reorderState = { row, id: d.id, startY: e.clientY, started: false };
  });
  draftList.addEventListener('pointermove', (e) => {
    if (!reorderState) return;
    const { row, id, startY } = reorderState;
    if (!reorderState.started) {
      if (Math.abs(e.clientY - startY) < 6) return;
      reorderState.started = true;
      row.classList.add('dragging');
    }
    draftList.querySelectorAll('.draft-row').forEach(r => r.classList.remove('drop-target'));
    const target = [...draftList.querySelectorAll('.draft-row')].find(r => {
      if (r === row) return false;
      const rc = r.getBoundingClientRect();
      return e.clientY > rc.top && e.clientY < rc.bottom;
    });
    if (target) target.classList.add('drop-target');
  });
  const finishReorder = (e) => {
    if (!reorderState) return;
    const { row, id, started } = reorderState;
    if (started) {
      const target = [...draftList.querySelectorAll('.draft-row')].find(r => {
        if (r === row) return false;
        const rc = r.getBoundingClientRect();
        return e.clientY > rc.top && e.clientY < rc.bottom;
      });
      if (target) {
        const td = rowDraftMap.get(target);
        if (td && td.id !== id) reorderDraft(id, td.id);
      }
    }
    row.classList.remove('dragging');
    draftList.querySelectorAll('.draft-row').forEach(r => r.classList.remove('drop-target'));
    reorderState = null;
  };
  draftList.addEventListener('pointerup', finishReorder);
  draftList.addEventListener('pointercancel', () => finishReorder({ clientY: 0 }));
}
enableRowReorder();

// ==================== save ====================
function scheduleSave() {
  const draft = activeDraft();
  if (!draft) return;
  draft.title = titleInput.value.trim() || '未命名草稿';
  draft.content = editor.value;
  saveStatus.textContent = '已修改';
  saveStatus.className = 'save-status';
  clearTimeout(saveTimer);
  if (!settings.auto_save) return;
  saveTimer = setTimeout(() => saveDraftNow(), 650);
}

async function saveDraftNow(draft = activeDraft()) {
  if (!draft) return;
  saveStatus.textContent = '保存中…';
  saveStatus.className = 'save-status saving';
  try {
    const newPath = await invoke('write_draft', {
      path: draft.path,
      title: draft.title,
      content: draft.content,
    });
    if (newPath !== draft.path) {
      const idx = drafts.findIndex(d => d.id === draft.path);
      if (idx >= 0) drafts[idx].path = newPath;
      if (activeId === draft.path) activeId = newPath;
      if (contextId === draft.path) contextId = newPath;
      draft.path = newPath;
      draft.id = newPath;
    }
    const m = /[/\\]([^/\\]+)\.txt$/.exec(newPath);
    if (m && m[1]) draft.title = m[1];
    saveStatus.textContent = '已保存';
    saveStatus.className = 'save-status';
    renderList();
  } catch (e) {
    console.error('save failed', e);
    saveStatus.textContent = '保存失败';
    saveStatus.className = 'save-status error';
  }
}

function flushSave() {
  if (!saveTimer) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  const draft = activeDraft();
  if (draft) { draft.title = titleInput.value.trim() || '未命名草稿'; draft.content = editor.value; }
  saveDraftNow(draft);
  saveStatus.textContent = '已保存';
  saveStatus.className = 'save-status';
}

// ==================== window states ====================
async function expand(focusEditor = false) {
  appEl.classList.remove('searching');
  appEl.classList.add('expanded');
  expandedShell.classList.remove('preview-open');
  appEl.classList.remove('preview-mode', 'preview-left', 'preview-right');
  settingsPopover.classList.remove('show');
  await resizeWindow();
  if (focusEditor) setTimeout(() => openPreview(activeId, true), 170);
}

async function collapse() {
  flushSave();
  closeTransient();
  clearTimeout(previewCloseTimer);
  if (isPreviewOpen()) {
    expandedShell.classList.remove('preview-open');
    appEl.classList.remove('preview-mode', 'preview-left', 'preview-right');
  }
  appEl.classList.remove('expanded');
  await resizeWindow();
}

async function openPreview(id, focusEditor = false) {
  await selectDraft(id);
  // 已在预览态：保持当前方向与布局，只切换内容（避免重新算方向导致错乱/闪烁）
  if (isPreviewOpen()) {
    if (focusEditor) editor.focus();
    return;
  }
  clearTimeout(previewCloseTimer);
  appEl.classList.remove('preview-closing');
  // 首次展开：按屏幕距离选方向（编辑放在不会超出屏幕边缘的一侧）
  let side = 'right';
  try {
    const monitor = await currentMonitor();
    if (monitor) {
      const scale = monitor.scaleFactor;
      const pos = await win.outerPosition();
      const dirScreenLeft = pos.x;
      const editRight = dirScreenLeft + (DIR_CENTER + DIR_W + EDIT_W) * scale;
      side = 'right';
      if (editRight > monitor.position.x + monitor.size.width) side = 'left';
    }
  } catch (e) {}
  previewSide = side;
  // 第 1 步：先 resize 到 1192 + 左移保持目录屏幕位置（目录仍是展开态在窗口 0，不跳、不溢出窗口）
  const monitor = await currentMonitor();
  const scale = monitor ? monitor.scaleFactor : 1;
  const pos = await win.outerPosition();
  const dirScreenLeft = pos.x;
  const newX = dirScreenLeft - DIR_CENTER * scale;
  await win.setSize(new LogicalSize(WINDOW_SIZE.preview.w, WINDOW_SIZE.preview.h));
  if (newX !== pos.x) await win.setPosition(new PhysicalPosition(newX, pos.y));
  // 第 2 步：下一帧加预览类——目录从 0 平滑滑到 472，编辑器无过渡直接定位目标侧
  requestAnimationFrame(() => {
    const editorPanel = document.querySelector('.editor-panel');
    editorPanel.classList.add('no-preview-transition');
    appEl.classList.toggle('preview-left', previewSide === 'left');
    appEl.classList.toggle('preview-right', previewSide === 'right');
    appEl.classList.add('preview-mode');
    expandedShell.classList.add('preview-open');
    requestAnimationFrame(() => {
      editorPanel.classList.remove('no-preview-transition');
      if (focusEditor) editor.focus();
    });
  });
}

async function closePreview() {
  flushSave();
  if (!isPreviewOpen()) return;
  clearTimeout(previewCloseTimer);
  appEl.classList.add('preview-closing');
  appEl.classList.remove('preview-mode', 'preview-left', 'preview-right');
  expandedShell.classList.remove('preview-open');
  await resizeWindow();
  previewCloseTimer = setTimeout(() => {
    appEl.classList.remove('preview-closing');
  }, 230);
}

async function hideApp() {
  flushSave();
  closeTransient();
  clearTimeout(previewCloseTimer);
  if (isPreviewOpen()) {
    expandedShell.classList.remove('preview-open');
    appEl.classList.remove('preview-mode', 'preview-left', 'preview-right');
  }
  appEl.classList.remove('expanded', 'searching');
  appEl.classList.add('hidden');
  await resizeWindow();
  await win.hide();
  showToast('拾笺已隐藏');
}

async function restoreHidden() {
  if (!appEl.classList.contains('hidden')) return false;
  await win.show();
  await win.setFocus();
  appEl.classList.remove('hidden');
  appEl.classList.remove('expanded', 'searching', 'preview-mode', 'preview-left', 'preview-right');
  expandedShell.classList.remove('preview-open');
  await resizeWindow();
  renderList();
  return true;
}

async function createDraft() {
  flushSave();
  let path;
  try {
    path = await invoke('write_draft', { path: null, title: '未命名草稿', content: '' });
  } catch (e) {
    console.error(e);
    showToast('创建失败');
    return;
  }
  drafts.unshift({ id: path, path, title: '未命名草稿', content: '', mtime: Date.now(), pinned: false, loaded: true });
  closeTransient();
  appEl.classList.remove('hidden', 'searching');
  appEl.classList.add('expanded');
  activeId = path;
  await openPreview(path, true);
  showToast('已创建新草稿');
}

// ==================== topmost ====================
function syncTopmostUI() {
  appEl.classList.toggle('always-on-top', alwaysOnTop);
  topmostButton.classList.toggle('toggle-active', alwaysOnTop);
  topmostButton.setAttribute('aria-pressed', String(alwaysOnTop));
  topmostButton.title = alwaysOnTop ? '取消保持在最前' : '保持在最前';
  topmostButton.setAttribute('aria-label', topmostButton.title);
  topmostSwitch.classList.toggle('on', alwaysOnTop);
  topmostSwitch.setAttribute('aria-pressed', String(alwaysOnTop));
  windowTopmostLabel.textContent = alwaysOnTop ? '取消保持在最前' : '保持在最前';
  windowTopmostCheck.textContent = alwaysOnTop ? '✓' : '';
}

async function toggleAlwaysOnTop(nextValue) {
  alwaysOnTop = typeof nextValue === 'boolean' ? nextValue : !alwaysOnTop;
  settings.always_on_top = alwaysOnTop;
  try { localStorage.setItem('shijian-always-on-top', String(alwaysOnTop)); } catch {}
  await win.setAlwaysOnTop(alwaysOnTop);
  await invoke('set_settings', { settings });
  syncTopmostUI();
  showToast(alwaysOnTop ? '已保持在最前' : '已取消保持在最前');
}

// ==================== context menu ====================
function openContextMenu(event, id) {
  event.preventDefault();
  contextId = id;
  activeId = id;
  const draft = drafts.find(item => item.id === id);
  if (!draft) return;
  pinActionLabel.textContent = draft.pinned ? '取消置顶' : '置顶';
  selectDraft(id);
  const rect = appEl.getBoundingClientRect();
  const x = Math.min(event.clientX - rect.left, rect.width - 188);
  const y = Math.min(event.clientY - rect.top, rect.height - 180);
  contextMenu.style.left = `${Math.max(6, x)}px`;
  contextMenu.style.top = `${Math.max(34, y)}px`;
  contextMenu.classList.add('show');
  windowContextMenu.classList.remove('show');
  settingsPopover.classList.remove('show');
}

function closeTransient() {
  contextMenu.classList.remove('show');
  windowContextMenu.classList.remove('show');
  settingsPopover.classList.remove('show');
}

function requestDelete() {
  const draft = drafts.find(d => d.id === (contextId || activeId));
  if (!draft) return;
  contextId = draft.id;
  deleteText.textContent = `“${draft.title}.txt”将被移动到系统回收站。`;
  contextMenu.classList.remove('show');
  modalLayer.classList.add('show');
}

async function deleteDraft() {
  const draft = drafts.find(d => d.id === contextId);
  if (!draft) return;
  try {
    await invoke('delete_to_recycle', { path: draft.path });
  } catch (e) {
    console.error(e);
    showToast('删除失败');
    modalLayer.classList.remove('show');
    return;
  }
  drafts = drafts.filter(d => d.id !== contextId);
  settings.pinned = settings.pinned.filter(p => p !== contextId);
  await invoke('set_settings', { settings });
  activeId = drafts[0]?.id || null;
  modalLayer.classList.remove('show');
  if (activeId) await selectDraft(activeId);
  else { titleInput.value = ''; editor.value = ''; renderList(); }
  showToast('已移到系统回收站');
}

async function copyDraftContent(draft) {
  if (!draft) return;
  try {
    await navigator.clipboard.writeText(draft.content);
  } catch {
    const helper = document.createElement('textarea');
    helper.value = draft.content;
    helper.style.position = 'fixed';
    helper.style.opacity = '0';
    document.body.appendChild(helper);
    helper.select();
    document.execCommand('copy');
    helper.remove();
  }
  showToast('已复制到剪贴板');
}

// ==================== toast ====================
function showToast(message) {
  toastText.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1500);
}

// ==================== static event bindings ====================
collapsedBar.addEventListener('dblclick', event => { if (!event.target.closest('button,input')) expand(); });
collapsedBar.addEventListener('contextmenu', event => {
  event.preventDefault();
  syncTopmostUI();
  windowContextMenu.classList.add('show');
  contextMenu.classList.remove('show');
  settingsPopover.classList.remove('show');
});
windowToolbar.addEventListener('dblclick', event => {
  if (!event.target.closest('button,input')) collapse();
});
addButton.addEventListener('click', createDraft);
hideButton.addEventListener('click', hideApp);
collapsedHideButton.addEventListener('click', hideApp);
copyCurrentButton.addEventListener('click', () => copyDraftContent(activeDraft()));
searchInput.addEventListener('input', () => renderList());
titleInput.addEventListener('input', scheduleSave);
editor.addEventListener('input', scheduleSave);
topmostButton.addEventListener('click', () => toggleAlwaysOnTop());
topmostSwitch.addEventListener('click', () => toggleAlwaysOnTop());
settingsButton.addEventListener('click', event => {
  event.stopPropagation();
  settingsPopover.classList.toggle('show');
  contextMenu.classList.remove('show');
  windowContextMenu.classList.remove('show');
});

autostartSwitch.addEventListener('click', async () => {
  const on = autostartSwitch.classList.toggle('on');
  settings.autostart = on;
  try { await invoke('set_autostart', { enabled: on }); } catch (e) { console.error(e); }
  await invoke('set_settings', { settings });
});
hotkeySwitch.addEventListener('click', async () => {
  const on = hotkeySwitch.classList.toggle('on');
  settings.hotkey = on;
  try { await invoke('set_hotkey', { enabled: on }); } catch (e) { console.error(e); }
  await invoke('set_settings', { settings });
});
autoSaveSwitch.addEventListener('click', () => {
  const on = autoSaveSwitch.classList.toggle('on');
  settings.auto_save = on;
  invoke('set_settings', { settings });
});
transparentSwitch.addEventListener('click', () => {
  const on = transparentSwitch.classList.toggle('on');
  document.body.classList.toggle('transparent-on', on);
  settings.transparent = on;
  invoke('set_settings', { settings });
});

document.querySelectorAll('#themeSegment button').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('#themeSegment button').forEach(b => b.classList.remove('active'));
  button.classList.add('active');
  const theme = button.dataset.theme === 'auto'
    ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : button.dataset.theme;
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('shijian-theme', theme); } catch {}
}));

document.getElementById('conflictDemoButton').addEventListener('click', () => { settingsPopover.classList.remove('show'); conflictBanner.classList.add('show'); });
document.getElementById('reloadButton').addEventListener('click', async () => {
  conflictBanner.classList.remove('show');
  const draft = activeDraft();
  if (draft) {
    try {
      const content = await invoke('read_draft', { path: draft.path });
      draft.content = content;
      editor.value = content;
    } catch (e) { console.error(e); }
  }
  showToast('已重新载入文件');
});
document.getElementById('ignoreButton').addEventListener('click', () => conflictBanner.classList.remove('show'));
document.getElementById('cancelDelete').addEventListener('click', () => modalLayer.classList.remove('show'));
document.getElementById('confirmDelete').addEventListener('click', deleteDraft);

contextMenu.addEventListener('click', async event => {
  const item = event.target.closest('.menu-item');
  if (!item) return;
  const draft = drafts.find(d => d.id === contextId);
  if (!draft) return;
  const action = item.dataset.action;
  if (action === 'pin') {
    draft.pinned = !draft.pinned;
    settings.pinned = draft.pinned
      ? [...new Set([...settings.pinned, draft.path])]
      : settings.pinned.filter(p => p !== draft.path);
    await invoke('set_settings', { settings });
    renderList();
    pinActionLabel.textContent = draft.pinned ? '取消置顶' : '置顶';
    showToast(draft.pinned ? '已置顶' : '已取消置顶');
  }
  if (action === 'rename') { titleInput.focus(); titleInput.select(); }
  if (action === 'copy') await copyDraftContent(draft);
  if (action === 'folder') { invoke('open_folder', { path: draft.path }); showToast('已在资源管理器中显示'); }
  if (action === 'delete') return requestDelete();
  contextMenu.classList.remove('show');
});

windowContextMenu.addEventListener('click', event => {
  const item = event.target.closest('.menu-item');
  if (!item) return;
  const action = item.dataset.windowAction;
  if (action === 'topmost') toggleAlwaysOnTop();
  if (action === 'expand') expand();
  if (action === 'new') createDraft();
  if (action === 'hide') hideApp();
  windowContextMenu.classList.remove('show');
});

document.addEventListener('pointerdown', event => {
  if (!settingsPopover.contains(event.target) && !settingsButton.contains(event.target)) settingsPopover.classList.remove('show');
  if (!contextMenu.contains(event.target) && !event.target.closest('.draft-row')) contextMenu.classList.remove('show');
  if (!windowContextMenu.contains(event.target)) windowContextMenu.classList.remove('show');
});

document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.code === 'Space') {
    event.preventDefault();
    if (appEl.classList.contains('hidden')) restoreHidden();
    else if (appEl.classList.contains('expanded')) collapse();
    else expand();
  }
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'n') { event.preventDefault(); createDraft(); }
  if (event.key === 'Escape') {
    if (modalLayer.classList.contains('show')) modalLayer.classList.remove('show');
    else if (settingsPopover.classList.contains('show') || contextMenu.classList.contains('show') || windowContextMenu.classList.contains('show')) closeTransient();
    else if (isPreviewOpen()) closePreview();
    else if (appEl.classList.contains('expanded')) collapse();
  }
});

// ==================== native events ====================
function handleGlobalToggle() {
  if (appEl.classList.contains('hidden')) { restoreHidden(); }
  else if (appEl.classList.contains('expanded')) collapse();
  else expand();
}

async function reloadAfterExternalChange() {
  await reloadDrafts();
  const cur = activeDraft();
  if (cur && cur.loaded) {
    try {
      const disk = await invoke('read_draft', { path: cur.path });
      if (disk !== cur.content) conflictBanner.classList.add('show');
    } catch (e) { /* 文件可能已被外部删除 */ }
  }
}

async function setupNativeEvents() {
  await listen('global-hotkey', e => {
    if (e.payload === 'toggle') handleGlobalToggle();
    else if (e.payload === 'new') createDraft();
  });
  await listen('drafts-changed', () => { reloadAfterExternalChange(); });
  // 安全网：窗口恢复焦点但前端仍标记 hidden 时强制解除，防止事件链丢失导致不可交互
  try {
    await win.onFocusChanged(({ payload: focused }) => {
      if (focused && appEl.classList.contains('hidden')) {
        appEl.classList.remove('hidden');
        resizeWindow();
      }
    });
  } catch (e) { console.error('focus watcher', e); }
  // 拖动窗口时实时检查：预览区实际接触到当前显示器左右边缘才交换到目录另一侧
  try {
    await win.onMoved(async () => {
      if (!isPreviewOpen()) return;
      const monitor = await currentMonitor();
      if (!monitor) return;
      const pos = await win.outerPosition();
      const size = await win.outerSize();
      const mLeft = monitor.position.x;
      const mRight = monitor.position.x + monitor.size.width;
      if (previewSide === 'right') {
        if (pos.x + size.width >= mRight) await applyPreviewSide('left');
      } else {
        if (pos.x <= mLeft) await applyPreviewSide('right');
      }
    });
  } catch (e) { console.error('moved watcher', e); }
}

// ==================== init ====================
function applySettingSwitches() {
  autostartSwitch.classList.toggle('on', !!settings.autostart);
  hotkeySwitch.classList.toggle('on', !!settings.hotkey);
  autoSaveSwitch.classList.toggle('on', !!settings.auto_save);
  transparentSwitch.classList.toggle('on', !!settings.transparent);
  document.body.classList.toggle('transparent-on', !!settings.transparent);
}

function syncThemeSegment() {
  const cur = document.documentElement.dataset.theme || 'dark';
  document.querySelectorAll('#themeSegment button').forEach(b => b.classList.toggle('active', b.dataset.theme === cur));
}

async function init() {
  try {
    const savedTheme = localStorage.getItem('shijian-theme');
    if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'auto') {
      document.documentElement.dataset.theme = savedTheme === 'auto'
        ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : savedTheme;
    }
  } catch {}
  try {
    settings = await invoke('get_settings');
  } catch (e) { console.error(e); }
  alwaysOnTop = settings.always_on_top;
  applySettingSwitches();
  syncTopmostUI();
  syncThemeSegment();
  try { storePathDisplay.textContent = `${await invoke('get_store_dir')} →`; } catch (e) {}
  try {
    await setupNativeEvents();
  } catch (e) { console.error('native events', e); }
  await reloadDrafts();
}

init();
