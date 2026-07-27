export function showContextMenu(x, y) {
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.innerHTML = '<div>置顶</div><div>重命名</div><div>删除</div>';
  document.body.appendChild(menu);
  return menu;
}
