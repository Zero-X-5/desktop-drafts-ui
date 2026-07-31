    async function updatePreviewSide() {
      if (!isPreviewOpen() || nativeLayoutUpdating) return previewSide;
      const anchor = await currentDirectoryAnchor();
      const nextSide = choosePreviewSideOnMonitor(
        anchor.directoryLeft,
        anchor.directoryWidth,
        anchor.monitor,
      );
      if (nextSide === previewSide) return previewSide;

      setPreviewSide(nextSide);
      await applyNativeLayout({
        width: getPreviewWindowWidth(),
        height: EXPANDED_WINDOW_HEIGHT,
        directoryLeft: anchor.directoryLeft,
        side: nextSide,
      });
      return nextSide;
    }

    async function openPreview(id, focusEditor = false) {
      selectDraft(id);
      clearTimeout(previewCloseTimer);
      appWindow.classList.remove('preview-closing');

      const anchor = await currentDirectoryAnchor();
      const side = choosePreviewSideOnMonitor(
        anchor.directoryLeft,
        anchor.directoryWidth,
        anchor.monitor,
      );
      setPreviewSide(side);

      appWindow.classList.add('expanded', 'preview-mode');
      windowContent.classList.add('preview-open');
      await applyNativeLayout({
        width: getPreviewWindowWidth(),
        height: EXPANDED_WINDOW_HEIGHT,
        directoryLeft: anchor.directoryLeft,
        side,
      });

      if (focusEditor) requestAnimationFrame(() => editor.focus());
    }

    async function closePreview() {
      flushSave();
      if (!isPreviewOpen()) return;
      clearTimeout(previewCloseTimer);

      const anchor = await currentDirectoryAnchor();
      appWindow.classList.add('preview-closing');
      appWindow.classList.remove('preview-mode');
      closeTransient();

      await applyNativeLayout({
        width: DIRECTORY_WIDTH,
        height: EXPANDED_WINDOW_HEIGHT,
        directoryLeft: anchor.directoryLeft,
        side: 'right',
      });

      windowContent.classList.remove('preview-open');
      appWindow.classList.remove('preview-closing');
      draftList.querySelector(`[data-id="${activeId}"]`)?.focus();
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

    async function expand(focusEditor = false) {
      const anchor = await currentDirectoryAnchor();
      appWindow.classList.remove('searching', 'preview-mode');
      windowContent.classList.remove('preview-open');
      appWindow.classList.add('expanded');
      settingsPopover.classList.remove('show');
      await applyNativeLayout({
        width: DIRECTORY_WIDTH,
        height: EXPANDED_WINDOW_HEIGHT,
        directoryLeft: anchor.directoryLeft,
        side: 'right',
      });
      renderList();
      if (focusEditor) window.setTimeout(() => openPreview(activeId, true), 120);
    }

    async function collapse() {
      flushSave();
      closeTransient();
      clearTimeout(previewCloseTimer);
      const anchor = await currentDirectoryAnchor();
      appWindow.classList.remove('preview-mode', 'preview-closing', 'expanded');
      windowContent.classList.remove('preview-open');
      await applyNativeLayout({
        width: DIRECTORY_WIDTH,
        height: COLLAPSED_WINDOW_HEIGHT,
        directoryLeft: anchor.directoryLeft,
        side: 'right',
      });
    }

    async function hideApp() {
      flushSave();
      closeTransient();
      await desktopWindow.minimize();
    }

    function restoreHidden() {
      return false;
    }

    function createDraft() {
      flushSave();
      const id = Date.now();
      drafts.unshift({ id, title: '未命名草稿', content: '', time: '刚刚', pinned: false });
      closeTransient();
      appWindow.classList.remove('hidden', 'searching');
      appWindow.classList.add('expanded');
      openPreview(id, true);
      showToast('已创建新草稿');
    }

    function scheduleSave() {
      const draft = activeDraft();
      if (!draft) return;
      draft.title = titleInput.value.trim() || '未命名草稿';
      draft.content = editor.value;
      draft.time = '刚刚';
      saveStatus.textContent = '已修改';
      saveStatus.className = 'save-status';
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        saveStatus.textContent = '保存中…';
        saveStatus.className = 'save-status saving';
        setTimeout(() => {
          saveStatus.textContent = '已保存';
          saveStatus.className = 'save-status';
          renderList();
        }, 360);
      }, 650);
    }

    function flushSave() {
      if (!saveTimer) return;
      clearTimeout(saveTimer);
      saveTimer = null;
      const draft = activeDraft();
      if (draft) { draft.title = titleInput.value.trim() || '未命名草稿'; draft.content = editor.value; draft.time = '刚刚'; }
      saveStatus.textContent = '已保存';
      saveStatus.className = 'save-status';
      renderList();
    }

    function showToast(message) {
      toastText.textContent = message;
      toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('show'), 1500);
    }

    function syncTopmostUI() {
      appWindow.classList.toggle('always-on-top', alwaysOnTop);
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
      try {
        await desktopWindow.setAlwaysOnTop(alwaysOnTop);
        localStorage.setItem('shijian-always-on-top', String(alwaysOnTop));
        syncTopmostUI();
        showToast(alwaysOnTop ? '已保持在最前' : '已取消保持在最前');
      } catch (error) {
        alwaysOnTop = !alwaysOnTop;
        syncTopmostUI();
        showToast('置顶状态修改失败');
        console.error(error);
      }
    }
