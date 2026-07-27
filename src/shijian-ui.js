const app = document.getElementById('app');

app.innerHTML = `
<div class="shijian-window">
  <div class="brand">✦ 拾笺</div>
  <div class="hint">Desktop runtime connected</div>
</div>`;

const style = document.createElement('style');
style.textContent = `
.shijian-window{
 width:240px;
 height:36px;
 border-radius:10px;
 background:rgba(30,31,35,.68);
 backdrop-filter:blur(26px);
 border:1px solid rgba(255,255,255,.16);
 box-shadow:0 10px 38px rgba(0,0,0,.38);
 color:#f5f5f7;
 display:flex;
 align-items:center;
 padding:0 12px;
 gap:8px;
 -webkit-app-region:drag;
}
.brand{font-size:12px;font-weight:600}
.hint{font-size:11px;color:#aaa}
`;
document.head.appendChild(style);
