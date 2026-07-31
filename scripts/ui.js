    function openContextMenu(event, id) {
      event.preventDefault();
      contextId = id;
      activeId = id;
      const draft = drafts.find(item => item.id === id);
      if (!draft) return;
      pinActionLabel.textContent = draft.pinned ? '取消置顶' : '置顶';
      selectDraft(id);
      const rect = appWindow.getBoundingClientRect();
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

    function deleteDraft() {
      drafts = drafts.filter(d => d.id !== contextId);
      activeId = drafts[0]?.id || null;
      modalLayer.classList.remove('show');
      if (activeId) selectDraft(activeId);
      else { titleInput.value = ''; editor.value = ''; renderList(); }
      showToast('已移到系统回收站');
    }

    function escapeHtml(value) { return value.replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

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
    document.querySelectorAll('.switch:not(#topmostSwitch)').forEach(sw => sw.addEventListener('click', () => sw.classList.toggle('on')));
    document.querySelectorAll('#themeSegment button').forEach(button => button.addEventListener('click', () => {
      document.querySelectorAll('#themeSegment button').forEach(b => b.classList.remove('active'));
      button.classList.add('active');
      const theme = button.dataset.theme === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : button.dataset.theme;
      document.documentElement.dataset.theme = theme;
    }));
    document.getElementById('conflictDemoButton').addEventListener('click', () => { settingsPopover.classList.remove('show'); conflictBanner.classList.add('show'); });
    document.getElementById('reloadButton').addEventListener('click', () => { conflictBanner.classList.remove('show'); showToast('已重新载入文件'); });
    document.getElementById('ignoreButton').addEventListener('click', () => conflictBanner.classList.remove('show'));
    document.getElementById('cancelDelete').addEventListener('click', () => modalLayer.classList.remove('show'));
    document.getElementById('confirmDelete').addEventListener('click', deleteDraft);
    contextMenu.addEventListener('click', async event => {
      const item = event.target.closest('.menu-item');
      if (!item) return;
      const draft = drafts.find(d => d.id === contextId);
      if (!draft) return;
      if (item.dataset.action === 'pin') {
        draft.pinned = !draft.pinned;
        renderList();
        pinActionLabel.textContent = draft.pinned ? '取消置顶' : '置顶';
        showToast(draft.pinned ? '已置顶' : '已取消置顶');
      }
      if (item.dataset.action === 'rename') { titleInput.focus(); titleInput.select(); }
      if (item.dataset.action === 'copy') await copyDraftContent(draft);
      if (item.dataset.action === 'folder') showToast('将在资源管理器中显示');
      if (item.dataset.action === 'delete') return requestDelete();
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
        if (!restoreHidden()) {
          appWindow.classList.contains('expanded') ? collapse() : expand();
        }
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'n') { event.preventDefault(); createDraft(); }
      if (event.key === 'Escape') {
        if (modalLayer.classList.contains('show')) modalLayer.classList.remove('show');
        else if (settingsPopover.classList.contains('show') || contextMenu.classList.contains('show') || windowContextMenu.classList.contains('show')) closeTransient();
        else if (windowContent.classList.contains('preview-open')) closePreview();
        else if (appWindow.classList.contains('expanded')) collapse();
      }
    });

    desktopWindow.onMoved(() => {
      if (!isPreviewOpen() || nativeLayoutUpdating) return;
      clearTimeout(nativeMoveTimer);
      nativeMoveTimer = window.setTimeout(() => {
        updatePreviewSide().catch(console.error);
      }, 90);
    });

    setPreviewSide(previewSide);
    desktopWindow.setAlwaysOnTop(alwaysOnTop).catch(console.error);
    syncTopmostUI();
    selectDraft(activeId);
    renderList();
