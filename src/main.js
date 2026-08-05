/* Bootstrap the original application logic, then install the resize
   synchronization layer. Kept as a tiny loader so the core file stays intact. */
(() => {
  const loadSequentially = () => {
    const core = document.createElement('script');
    core.src = 'main-core.js';
    core.onload = () => {
      const fixes = document.createElement('script');
      fixes.src = 'resize-fixes.js';
      document.body.appendChild(fixes);
    };
    document.body.appendChild(core);
  };

  if (document.readyState === 'loading') {
    document.write('<script src="main-core.js"><\/script>');
    document.write('<script src="resize-fixes.js"><\/script>');
  } else {
    loadSequentially();
  }
})();
