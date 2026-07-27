export function renderEditor(container, note = {}) {
  container.innerHTML = `
    <div class="editor">
      <input class="editor-title" value="${note.title || ''}" />
      <textarea class="editor-body">${note.content || ''}</textarea>
    </div>`;
}
