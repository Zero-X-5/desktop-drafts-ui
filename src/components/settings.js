export function renderSettings(container) {
  container.innerHTML = `
    <div class="settings-panel">
      <h3>设置</h3>
      <label><input type="checkbox" /> 开机启动</label>
      <label><input type="checkbox" /> 自动保存</label>
    </div>`;
}
