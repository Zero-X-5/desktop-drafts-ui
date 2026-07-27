const state = {
  topmost: true,
  expanded: false,
  previewSide: localStorage.getItem('shijian-preview-side') || 'left',
  activeNote: 0
};

const notes = [
  { id: 0, title: '欢迎使用拾笺', preview: '快速记录你的想法', content: '这是拾笺桌面版。' },
  { id: 1, title: '项目计划', preview: '下一步开发任务', content: '完善文件系统和快捷键。' }
];

const app = document.getElementById('app');

function render(){
  app.innerHTML = `
  <div class="shijian-shell ${state.expanded ? 'expanded' : ''} ${state.previewSide === 'left' ? 'preview-left':'preview-right'}">
    <div class="shijian-window">
      <div class="brand">✦ 拾笺</div>
      <div class="actions">
        <button id="topmost">${state.topmost ? '📌':'📍'}</button>
        <button id="expand">${state.expanded ? '−':'＋'}</button>
      </div>
    </div>
    ${state.expanded ? `
    <div class="workspace">
      <aside class="draft-list">
        ${notes.map(n=>`<div class="note ${n.id===state.activeNote?'active':''}" data-id="${n.id}">
          <div>${n.title}</div><small>${n.preview}</small>
        </div>`).join('')}
      </aside>
      <main class="editor">
        <h3>${notes[state.activeNote].title}</h3>
        <textarea>${notes[state.activeNote].content}</textarea>
      </main>
    </div>`:''}
  </div>`;

  document.getElementById('topmost').onclick=()=>{
    state.topmost=!state.topmost;
    window.shijian?.setTopmost?.(state.topmost);
    render();
  };

  document.getElementById('expand').onclick=()=>{
    state.expanded=!state.expanded;
    render();
  };

  document.querySelectorAll('.note').forEach(el=>{
    el.onclick=()=>{
      state.activeNote=Number(el.dataset.id);
      render();
    };
  });
}

const style=document.createElement('style');
style.textContent=`
body{margin:0;background:transparent;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI";color:#f5f5f7}
.shijian-shell{width:240px;transition:.25s cubic-bezier(.22,1,.36,1)}
.shijian-shell.expanded{width:680px}
.shijian-window{height:36px;border-radius:10px;background:rgba(30,31,35,.68);backdrop-filter:blur(26px);border:1px solid rgba(255,255,255,.16);display:flex;align-items:center;justify-content:space-between;padding:0 12px;-webkit-app-region:drag}
.actions{display:flex;gap:8px;-webkit-app-region:no-drag}button{border:0;background:none;color:inherit;cursor:pointer}
.workspace{margin-top:8px;height:416px;display:flex;border-radius:12px;overflow:hidden;background:rgba(30,31,35,.72);backdrop-filter:blur(30px);border:1px solid rgba(255,255,255,.14)}
.draft-list{width:240px;padding:12px;border-right:1px solid rgba(255,255,255,.1)}
.note{padding:10px;border-radius:8px;font-size:13px;cursor:pointer}.note.active{background:rgba(255,255,255,.12)}small{opacity:.6}
.editor{flex:1;padding:18px}.editor textarea{width:100%;height:300px;background:transparent;color:white;border:0;resize:none;outline:none}
.preview-left .workspace{flex-direction:row-reverse}
`;
document.head.appendChild(style);

render();
