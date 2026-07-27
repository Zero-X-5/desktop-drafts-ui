export function renderDraftList(container, drafts = []) {
  container.innerHTML = `
    <div class="draft-list">
      <div class="draft-search">搜索草稿</div>
      ${drafts.map(d => `
        <div class="draft-item" data-id="${d.id}">
          <div class="title">${d.title}</div>
          <div class="summary">${d.content.slice(0, 36)}</div>
        </div>`).join('')}
    </div>`;
}
