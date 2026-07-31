(() => {
  const sources = [
    './scripts/core.js',
    './scripts/desktop-fixes.js',
    './scripts/window.js',
    './scripts/ui.js',
  ];

  const loadNext = index => {
    if (index >= sources.length) return;
    const script = document.createElement('script');
    script.src = sources[index];
    script.onload = () => loadNext(index + 1);
    script.onerror = () => console.error(`Failed to load ${sources[index]}`);
    document.head.appendChild(script);
  };

  loadNext(0);
})();
