(() => {
  'use strict';
  if (window.__shijianResizeFixesLoaded) return;
  window.__shijianResizeFixesLoaded = true;

  const REGION = { collapsed: 'collapsed', expanded: 'expanded', preview: 'preview' };
  const PREVIEW_W = 472;
  const CANVAS_W = 720;
  let requested = 0;
  let chain = Promise.resolve();

  const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
  async function frames(count = 2) {
    while (count-- > 0) await frame();
  }
  const sideValue = side => side === 'left' ? 'left' : 'right';
  const sideNow = () => sideValue(previewSide);

  function setSide(side) {
    side = sideValue(side);
    previewSide = side;
    appEl.classList.toggle('preview-left', side === 'left');
    appEl.classList.toggle('preview-right', side === 'right');
    return side;
  }

  function stateNow() {
    if (isPreviewOpen() || appEl.classList.contains('preview-mode')) return REGION.preview;
    return appEl.classList.contains('expanded') ? REGION.expanded : REGION.collapsed;
  }

  const setRegion = (state, side = sideNow()) => invoke('set_window_region', {
    state,
    side: sideValue(side),
  });

  function queue(operation) {
    const version = ++requested;
    const run = async () => {
      if (version !== requested) return false;
      try { return await operation(version); }
      catch (error) {
        console.error('fixed-window transition failed', error);
        return false;
      }
    };
    chain = chain.catch(console.error).then(run);
    return chain;
  }

  async function anchorSide(target, state, version) {
    target = sideValue(target);
    const previous = sideNow();
    if (target === previous) {
      setSide(target);
      if (state !== REGION.preview) await setRegion(state, target);
      return version === requested;
    }

    const [position, scale] = await Promise.all([win.outerPosition(), win.scaleFactor()]);
    if (version !== requested) return false;
    const delta = Math.round(PREVIEW_W * scale);
    const x = previous === 'right' ? position.x - delta : position.x + delta;
    const move = win.setPosition(new PhysicalPosition(x, position.y));
    setSide(target);
    const crop = state === REGION.preview ? Promise.resolve() : setRegion(state, target);
    await Promise.all([move, crop]);
    return version === requested;
  }

  async function bestPreviewSide() {
    const current = sideNow();
    try {
      const monitor = await currentMonitor();
      const position = await win.outerPosition();
      if (!monitor) return current;
      const scale = monitor.scaleFactor;
      const directoryX = position.x + (current === 'left' ? PREVIEW_W * scale : 0);
      const left = monitor.position.x;
      const right = left + monitor.size.width;
      const fitsRight = directoryX + CANVAS_W * scale <= right;
      const fitsLeft = directoryX - PREVIEW_W * scale >= left;
      if (!fitsRight && fitsLeft) return 'left';
      if (!fitsLeft && fitsRight) return 'right';
    } catch {}
    return current;
  }

  async function clampPreview() {
    try {
      const monitor = await currentMonitor();
      const position = await win.outerPosition();
      if (!monitor) return;
      const left = monitor.position.x;
      const right = left + monitor.size.width;
      const maxX = Math.max(left, right - CANVAS_W * monitor.scaleFactor);
      const x = Math.min(Math.max(position.x, left), maxX);
      if (x !== position.x) await win.setPosition(new PhysicalPosition(x, position.y));
    } catch {}
  }

  resizeWindow = () => setRegion(stateNow(), sideNow());

  applyPreviewSide = side => queue(version => anchorSide(side, stateNow(), version));

  expand = async function expandFixed(focusEditor = false) {
    const completed = await queue(async version => {
      const side = setSide(sideNow());
      appEl.classList.remove('hidden', 'searching', 'preview-mode');
      expandedShell.classList.remove('preview-open');
      appEl.classList.add('expanded');
      settingsPopover.classList.remove('show');
      await frames();
      if (version !== requested) return false;
      await setRegion(REGION.expanded, side);
      return version === requested;
    });
    if (completed && focusEditor) await openPreview(activeId, true);
    return completed;
  };

  collapse = function collapseFixed() {
    flushSave();
    closeTransient();
    clearTimeout(previewCloseTimer);
    return queue(async version => {
      const side = sideNow();
      await setRegion(REGION.collapsed, side);
      if (version !== requested) return false;
      expandedShell.classList.remove('preview-open');
      appEl.classList.remove('expanded', 'searching', 'preview-mode');
      setSide(side);
      await frame();
      return version === requested;
    });
  };

  openPreview = async function openPreviewFixed(id, focusEditor = false) {
    await selectDraft(id);
    if (isPreviewOpen() && !appEl.classList.contains('hidden')) {
      if (focusEditor) editor.focus();
      return true;
    }
    clearTimeout(previewCloseTimer);
    const target = await bestPreviewSide();
    const completed = await queue(async version => {
      appEl.classList.remove('hidden', 'searching');
      appEl.classList.add('expanded');
      if (!await anchorSide(target, REGION.expanded, version)) return false;
      appEl.classList.add('preview-mode');
      expandedShell.classList.add('preview-open');
      await frames();
      if (version !== requested) return false;
      await setRegion(REGION.preview, target);
      await clampPreview();
      return version === requested;
    });
    if (completed && focusEditor) editor.focus();
    return completed;
  };

  closePreview = function closePreviewFixed() {
    flushSave();
    if (!isPreviewOpen() && !appEl.classList.contains('preview-mode')) return false;
    clearTimeout(previewCloseTimer);
    return queue(async version => {
      const side = sideNow();
      await setRegion(REGION.expanded, side);
      if (version !== requested) return false;
      expandedShell.classList.remove('preview-open');
      appEl.classList.remove('preview-mode');
      appEl.classList.add('expanded');
      setSide(side);
      await frame();
      return version === requested;
    });
  };

  hideApp = function hideAppFixed() {
    flushSave();
    closeTransient();
    clearTimeout(previewCloseTimer);
    return queue(async version => {
      const side = sideNow();
      await setRegion(REGION.collapsed, side);
      if (version !== requested) return false;
      expandedShell.classList.remove('preview-open');
      appEl.classList.remove('expanded', 'searching', 'preview-mode');
      setSide(side);
      appEl.classList.add('hidden');
      await win.hide();
      return version === requested;
    });
  };

  restoreHidden = function restoreHiddenFixed() {
    if (!appEl.classList.contains('hidden')) return false;
    return queue(async version => {
      const side = sideNow();
      expandedShell.classList.remove('preview-open');
      appEl.classList.remove('expanded', 'searching', 'preview-mode');
      setSide(side);
      await setRegion(REGION.collapsed, side);
      if (version !== requested) return false;
      await win.show();
      appEl.classList.remove('hidden');
      await frames();
      await win.setFocus();
      renderList();
      return version === requested;
    });
  };

  document.body.classList.remove('window-resizing', 'window-resize-ready');
  appEl.classList.remove('masking', 'preview-opening', 'preview-closing', 'preview-ready');
  setSide(sideNow());
  setRegion(stateNow(), sideNow()).catch(error => console.error('initial region failed', error));
})();
