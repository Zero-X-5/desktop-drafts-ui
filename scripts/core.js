const desktopWindow = window.desktopWindow ?? {
  async getContext() {
    return {
      position: { x: 0, y: 0 },
      monitor: {
        position: { x: 0, y: 0 },
        size: { width: window.screen.availWidth, height: window.screen.availHeight },
      },
    };
  },
  async applyLayout() {},
  async setAlwaysOnTop() {},
  async minimize() {},
  onMoved() { return () => {}; },
};
const appWindow = document.getElementById('appWindow');
    const collapsedBar = document.getElementById('collapsedBar');
    const windowToolbar = document.getElementById('windowToolbar');
    const collapsedTitle = document.getElementById('collapsedTitle');
    const collapsedHideButton = document.getElementById('collapsedHideButton');
    const hideButton = document.getElementById('hideButton');
    const copyCurrentButton = document.getElementById('copyCurrentButton');
    const topmostButton = document.getElementById('topmostButton');
    const topmostSwitch = document.getElementById('topmostSwitch');
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
    const windowContent = document.querySelector('.expanded-shell');
    const directoryView = document.getElementById('directoryView');

    let drafts = [
      { id: 1, title: '产品发布检查清单', content: '发布前检查：\n\n1. 完成构建验证\n2. 检查自动保存\n3. 测试系统托盘和全局快捷键\n4. 确认安装包签名', time: '10:42', pinned: true },
      { id: 2, title: '本周需要处理', content: '整理 Refero 参考界面\n完善拾笺交互规范\n确定深色和浅色主题', time: '09:18', pinned: true },
      { id: 3, title: '会议记录', content: '讨论拾笺第一版功能范围。核心仍然是快速 TXT，不扩展成完整笔记软件。', time: '昨天', pinned: false },
      { id: 4, title: '快捷键草案', content: '显示与隐藏：Ctrl + Shift + Space\n新建草稿：Ctrl + Shift + N', time: '周二', pinned: false },
      { id: 5, title: '灵感片段', content: '收起后像一个精致的桌面小物件，而不是普通窗口。', time: '周一', pinned: false },
      { id: 6, title: '待复制文本', content: '这是一段临时保存、稍后需要复制使用的纯文本。', time: '7月18日', pinned: false }
    ];
    let activeId = 1;
    let contextId = null;
    let draggedId = null;
    let saveTimer = null;
    let toastTimer = null;
    let alwaysOnTop = false;
    let previewSide = localStorage.getItem('shijian-preview-side') || 'left';
    let previewCloseTimer = null;
    const DIRECTORY_WIDTH = 248;
    const MOBILE_DIRECTORY_WIDTH = 48;
    const PREVIEW_WINDOW_MAX_WIDTH = 720;
    const WINDOW_MARGIN = 12;
    const PREVIEW_SIDE_DEAD_ZONE = 36;
    const COLLAPSED_WINDOW_HEIGHT = 36;
    const EXPANDED_WINDOW_HEIGHT = 480;
    const PREVIEW_CONTENT_WIDTH = PREVIEW_WINDOW_MAX_WIDTH - DIRECTORY_WIDTH;
    let nativeLayoutUpdating = false;
    let nativeMoveTimer = null;
    try { alwaysOnTop = localStorage.getItem('shijian-always-on-top') === 'true'; } catch {}

    function iconUse(id) { return `<svg><use href="#${id}"/></svg>`; }
    function activeDraft() { return drafts.find(d => d.id === activeId) || drafts[0] || null; }

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
      const row = d => `<button class="draft-row ${d.id === activeId ? 'selected' : ''}" data-id="${d.id}" draggable="true">
        <span class="pin-slot ${d.pinned ? '' : 'empty'}">${iconUse('i-pin')}</span>
        <span class="draft-name">${escapeHtml(d.title)}</span><span class="draft-time">${d.time}</span>
        <span class="draft-preview">${escapeHtml(d.content.replace(/\n/g, ' ') || '空白草稿')}</span>
        <span class="drag-handle" aria-hidden="true">${iconUse('i-grip')}</span>
      </button>`;
      let html = '';
      if (pinned.length) html += `<div class="group-label">置顶</div>${pinned.map(row).join('')}`;
      if (pinned.length && recent.length) html += '<div class="group-divider"></div>';
      if (recent.length) html += `<div class="group-label">最近修改</div>${recent.map(row).join('')}`;
      draftList.innerHTML = html;
      draftList.querySelectorAll('.draft-row').forEach(el => {
        el.addEventListener('click', () => {
          const id = Number(el.dataset.id);
          if (windowContent.classList.contains('preview-open') && activeId === id) closePreview();
          else openPreview(id);
        });
        el.addEventListener('contextmenu', event => openContextMenu(event, Number(el.dataset.id)));
        el.addEventListener('dragstart', event => {
          draggedId = Number(el.dataset.id);
          el.classList.add('dragging');
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', String(draggedId));
        });
        el.addEventListener('dragend', () => {
          draggedId = null;
          draftList.querySelectorAll('.draft-row').forEach(row => row.classList.remove('dragging', 'drop-target'));
        });
        el.addEventListener('dragover', event => {
          if (!draggedId || draggedId === Number(el.dataset.id)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          draftList.querySelectorAll('.draft-row').forEach(row => row.classList.remove('drop-target'));
          el.classList.add('drop-target');
        });
        el.addEventListener('drop', event => {
          event.preventDefault();
          if (!draggedId || draggedId === Number(el.dataset.id)) return;
          reorderDraft(draggedId, Number(el.dataset.id));
          draggedId = null;
          draftList.querySelectorAll('.draft-row').forEach(row => row.classList.remove('dragging', 'drop-target'));
        });
      });
    }

    function reorderDraft(sourceId, targetId) {
      const sourceIndex = drafts.findIndex(d => d.id === sourceId);
      const targetIndex = drafts.findIndex(d => d.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return;
      const [source] = drafts.splice(sourceIndex, 1);
      const target = drafts.find(d => d.id === targetId);
      if (!target) return;
      source.pinned = target.pinned;
      const nextTargetIndex = drafts.findIndex(d => d.id === targetId);
      drafts.splice(nextTargetIndex, 0, source);
      renderList();
      showToast(source.pinned ? '已移动到置顶' : '已更新顺序');
    }

    function selectDraft(id) {
      flushSave();
      activeId = id;
      const draft = activeDraft();
      if (!draft) return;
      titleInput.value = draft.title;
      editor.value = draft.content;
      saveStatus.textContent = '已保存';
      saveStatus.className = 'save-status';
      conflictBanner.classList.remove('show');
      renderList();
    }

    function isPreviewOpen() {
      return windowContent.classList.contains('preview-open');
    }

    function getDirectoryWidth() {
      return window.matchMedia('(max-width: 560px)').matches ? MOBILE_DIRECTORY_WIDTH : DIRECTORY_WIDTH;
    }

    function getPreviewWindowWidth() {
      return PREVIEW_WINDOW_MAX_WIDTH;
    }

    async function nativeWindowContext() {
      return desktopWindow.getContext();
    }

    function directoryScreenLeft(positionX, side = previewSide, previewOpen = isPreviewOpen()) {
      if (!previewOpen || side === 'right') return positionX;
      return positionX + PREVIEW_CONTENT_WIDTH;
    }

    function choosePreviewSideOnMonitor(directoryLeft, directoryWidth, monitor, fallback = previewSide) {
      if (!monitor) return fallback;
      const directoryCenter = directoryLeft + directoryWidth / 2;
      const monitorCenter = monitor.position.x + monitor.size.width / 2;
      const deadZone = PREVIEW_SIDE_DEAD_ZONE;
      if (directoryCenter < monitorCenter - deadZone) return 'right';
      if (directoryCenter > monitorCenter + deadZone) return 'left';
      return fallback;
    }

    async function applyNativeLayout({ width, height, directoryLeft, side = previewSide }) {
      nativeLayoutUpdating = true;
      appWindow.classList.add('native-layout-updating');
      try {
        await desktopWindow.applyLayout({ width, height, directoryLeft, side });
      } finally {
        window.setTimeout(() => {
          nativeLayoutUpdating = false;
          appWindow.classList.remove('native-layout-updating');
        }, 80);
      }
    }

    async function currentDirectoryAnchor() {
      const { position, monitor } = await nativeWindowContext();
      return {
        directoryLeft: directoryScreenLeft(position.x),
        directoryWidth: getDirectoryWidth(),
        position,
        monitor,
      };
    }

    function setPreviewSide(side) {
      if (side !== 'left' && side !== 'right') return;
      previewSide = side;
      appWindow.classList.toggle('preview-left', side === 'left');
      appWindow.classList.toggle('preview-right', side === 'right');
      try { localStorage.setItem('shijian-preview-side', side); } catch {}
    }
