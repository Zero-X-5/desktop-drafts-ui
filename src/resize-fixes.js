(() => {
  'use strict';

  if (window.__shijianResizeFixesLoaded) return;
  window.__shijianResizeFixesLoaded = true;

  const resizeMask = document.createElement('div');
  resizeMask.id = 'resizeMask';
  resizeMask.setAttribute('aria-hidden', 'true');
  appEl.appendChild(resizeMask);

  let requestedTransition = 0;
  let transitionChain = Promise.resolve();

  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));

  async function nextFrames(count = 2) {
    for (let index = 0; index < count; index += 1) await nextFrame();
  }

  function sizeForCurrentState() {
    const preview = isPreviewOpen();
    const expanded = appEl.classList.contains('expanded');
    const hidden = appEl.classList.contains('hidden');
    return (hidden || !expanded)
      ? WINDOW_SIZE.collapsed
      : preview ? WINDOW_SIZE.preview : WINDOW_SIZE.expanded;
  }

  async function setWindowSizeStable(size) {
    let finished = false;
    let unlisten = null;
    let settleTimer = null;
    let fallbackTimer = null;
    let finishResize;

    const resized = new Promise(resolve => {
      finishResize = () => {
        if (finished) return;
        finished = true;
        clearTimeout(settleTimer);
        clearTimeout(fallbackTimer);
        if (unlisten) {
          try { unlisten(); } catch {}
        }
        resolve();
      };
    });

    try {
      unlisten = await win.onResized(() => {
        clearTimeout(settleTimer);
        settleTimer = setTimeout(finishResize, 48);
      });
    } catch (error) {
      console.warn('resize listener unavailable', error);
    }

    fallbackTimer = setTimeout(finishResize, unlisten ? 360 : 96);

    try {
      await win.setSize(new LogicalSize(size.w, size.h));
    } catch (error) {
      console.error('window resize failed', error);
      finishResize();
    }

    try {
      const [innerSize, scaleFactor] = await Promise.all([
        win.innerSize(),
        win.scaleFactor(),
      ]);
      const widthReached = Math.abs(innerSize.width - size.w * scaleFactor) <= 1;
      const heightReached = Math.abs(innerSize.height - size.h * scaleFactor) <= 1;
      if (widthReached && heightReached) {
        clearTimeout(settleTimer);
        settleTimer = setTimeout(finishResize, 48);
      }
    } catch {}

    await resized;
    await nextFrames(2);
  }

  async function showResizeMask() {
    document.body.classList.remove('window-resize-ready');
    document.body.classList.add('window-resizing');
    appEl.classList.remove('preview-ready');
    appEl.classList.add('masking');
    await nextFrames(2);
  }

  async function hideResizeMask(version) {
    appEl.classList.remove(
      'masking',
      'preview-opening',
      'preview-closing',
      'preview-ready',
    );
    document.body.classList.add('window-resize-ready');

    await Promise.race([
      new Promise(resolve => {
        const onEnd = event => {
          if (event.target !== resizeMask || event.propertyName !== 'opacity') return;
          resizeMask.removeEventListener('transitionend', onEnd);
          resolve();
        };
        resizeMask.addEventListener('transitionend', onEnd);
      }),
      delay(220),
    ]);

    if (version !== requestedTransition) return false;
    document.body.classList.remove('window-resizing', 'window-resize-ready');
    return true;
  }

  function queueWindowTransition(operation) {
    const version = ++requestedTransition;

    const run = async () => {
      if (version !== requestedTransition) return false;
      await showResizeMask();
      if (version !== requestedTransition) return false;

      try {
        await operation(version);
      } catch (error) {
        console.error('window transition failed', error);
      }

      if (version !== requestedTransition) return false;
      await nextFrames(2);
      return hideResizeMask(version);
    };

    transitionChain = transitionChain.catch(error => {
      console.error('previous window transition failed', error);
    }).then(run);

    return transitionChain;
  }

  async function choosePreviewSide() {
    let side = 'right';
    try {
      const monitor = await currentMonitor();
      if (!monitor) return side;
      const position = await win.outerPosition();
      const rightEdge = monitor.position.x + monitor.size.width;
      if (position.x + WINDOW_SIZE.preview.w * monitor.scaleFactor > rightEdge) {
        side = 'left';
      }
    } catch {}
    return side;
  }

  async function keepPreviewOnScreen() {
    try {
      const monitor = await currentMonitor();
      if (!monitor) return;
      const position = await win.outerPosition();
      const rightEdge = monitor.position.x + monitor.size.width;
      const previewWidth = WINDOW_SIZE.preview.w * monitor.scaleFactor;
      if (position.x + previewWidth > rightEdge) {
        await win.setPosition(new PhysicalPosition(rightEdge - previewWidth, position.y));
      }
    } catch {}
  }

  resizeWindow = async function resizeWindowStable() {
    await setWindowSizeStable(sizeForCurrentState());
  };

  expand = async function expandStable(focusEditor = false) {
    const completed = await queueWindowTransition(async () => {
      appEl.classList.remove('hidden', 'searching');
      appEl.classList.add('expanded');
      expandedShell.classList.remove('preview-open');
      appEl.classList.remove('preview-mode', 'preview-left', 'preview-right');
      settingsPopover.classList.remove('show');
      await setWindowSizeStable(WINDOW_SIZE.expanded);
    });

    if (completed && focusEditor) await openPreview(activeId, true);
  };

  collapse = async function collapseStable() {
    flushSave();
    closeTransient();
    clearTimeout(previewCloseTimer);

    return queueWindowTransition(async () => {
      expandedShell.classList.remove('preview-open');
      appEl.classList.remove(
        'expanded',
        'preview-mode',
        'preview-left',
        'preview-right',
      );
      await setWindowSizeStable(WINDOW_SIZE.collapsed);
    });
  };

  openPreview = async function openPreviewStable(id, focusEditor = false) {
    await selectDraft(id);

    if (isPreviewOpen() && !document.body.classList.contains('window-resizing')) {
      if (focusEditor) editor.focus();
      return true;
    }

    const side = await choosePreviewSide();
    previewSide = side;
    clearTimeout(previewCloseTimer);

    const completed = await queueWindowTransition(async () => {
      appEl.classList.remove('hidden', 'searching');
      appEl.classList.add('expanded', 'preview-mode');
      appEl.classList.toggle('preview-left', side === 'left');
      appEl.classList.toggle('preview-right', side === 'right');
      expandedShell.classList.add('preview-open');

      await setWindowSizeStable(WINDOW_SIZE.preview);
      await keepPreviewOnScreen();
    });

    if (completed && focusEditor) editor.focus();
    return completed;
  };

  closePreview = async function closePreviewStable() {
    flushSave();
    if (!isPreviewOpen() && !appEl.classList.contains('preview-mode')) return false;
    clearTimeout(previewCloseTimer);

    return queueWindowTransition(async () => {
      expandedShell.classList.remove('preview-open');
      appEl.classList.remove(
        'preview-mode',
        'preview-left',
        'preview-right',
      );
      appEl.classList.add('expanded');
      await setWindowSizeStable(WINDOW_SIZE.expanded);
    });
  };

  hideApp = async function hideAppStable() {
    flushSave();
    closeTransient();
    clearTimeout(previewCloseTimer);

    const completed = await queueWindowTransition(async () => {
      expandedShell.classList.remove('preview-open');
      appEl.classList.remove(
        'expanded',
        'searching',
        'preview-mode',
        'preview-left',
        'preview-right',
      );
      await setWindowSizeStable(WINDOW_SIZE.collapsed);
      appEl.classList.add('hidden');
      await win.hide();
    });

    if (completed) showToast('拾笺已隐藏');
    return completed;
  };

  restoreHidden = async function restoreHiddenStable() {
    if (!appEl.classList.contains('hidden')) return false;

    return queueWindowTransition(async () => {
      expandedShell.classList.remove('preview-open');
      appEl.classList.remove(
        'expanded',
        'searching',
        'preview-mode',
        'preview-left',
        'preview-right',
      );
      await setWindowSizeStable(WINDOW_SIZE.collapsed);
      await win.show();
      appEl.classList.remove('hidden');
      await nextFrames(2);
      await win.setFocus();
      renderList();
    });
  };
})();
