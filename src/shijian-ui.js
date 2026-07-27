const state = {
  topmost: true,
  expanded: false,
  previewSide: localStorage.getItem('shijian-preview-side') || 'left'
};

const app = document.getElementById('app');

app.innerHTML = `
<div class="shijian-window" id="window">
  <div class="brand">✦ 拾笺</div>
  <div class="actions">
    <button id="topmost">📌</button>
    <button id="expand">＋</button>
  </div>
</div>`;

function render(){
  document.body.dataset.topmost = String(state.topmost);
  document.body.dataset.previewSide = state.previewSide;
}

document.getElementById('topmost').onclick = () => {
  state.topmost = !state.topmost;
  render();
};

document.getElementById('expand').onclick = () => {
  state.expanded = !state.expanded;
  document.body.classList.toggle('expanded', state.expanded);
};

window.addEventListener('resize', () => {
  const side = window.innerWidth > 900 ? 'left' : 'right';
  state.previewSide = side;
  localStorage.setItem('shijian-preview-side', side);
  render();
});

const style = document.createElement('style');
style.textContent = `
body{margin:0;background:transparent;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI"}
.shijian-window{
 width:240px;height:36px;border-radius:10px;
 background:rgba(30,31,35,.68);
 backdrop-filter:blur(26px);
 border:1px solid rgba(255,255,255,.16);
 color:#f5f5f7;display:flex;align-items:center;
 justify-content:space-between;padding:0 12px;
 -webkit-app-region:drag;
}
.actions{display:flex;gap:8px;-webkit-app-region:no-drag}
button{border:0;background:none;color:inherit;cursor:pointer}
.expanded .shijian-window{width:680px;height:460px}
`;
document.head.appendChild(style);

render();
