import { useEffect, useMemo, useState } from "react";
import { DraftList } from "./components/DraftList";
import { Icon } from "./components/Icon";
import { SettingsPopover } from "./components/SettingsPopover";
import { initialDrafts } from "./data/mock-drafts";
import { desktopApi } from "./services/desktop-api";
import { draftApi } from "./services/draft-api";
import type { Draft, PreviewSide, ThemeMode } from "./types";

const THEME_KEY = "shijian-theme-mode";
const PIN_KEY = "shijian-pinned";
const TRANSPARENCY_KEY = "shijian-reduced-transparency-v2";

export default function App() {
  const [drafts, setDrafts] = useState<Draft[]>(draftApi.isNative ? [] : initialDrafts);
  const [draftDirectory, setDraftDirectory] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [previewSide, setPreviewSide] = useState<PreviewSide>("left");
  const [collapsed, setCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ draftId: string; x: number; y: number } | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => (localStorage.getItem(THEME_KEY) as ThemeMode | null) || "system");
  const [pinned, setPinned] = useState(() => localStorage.getItem(PIN_KEY) === "true");
  const [autostart, setAutostart] = useState(false);
  const [reducedTransparency, setReducedTransparency] = useState(() => {
    const saved = localStorage.getItem(TRANSPARENCY_KEY);
    return saved === null ? true : saved === "true";
  });
  const [toast, setToast] = useState("");

  const filteredDrafts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return drafts;
    return drafts.filter((draft) => `${draft.title}\n${draft.content}`.toLowerCase().includes(normalizedQuery));
  }, [drafts, query]);
  const activeDraft = drafts.find((draft) => draft.id === activeId) || null;

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void desktopApi.initialize().then(async () => {
      await desktopApi.setAlwaysOnTop(pinned);
      if (!draftApi.isNative) return;
      try {
        const directory = await draftApi.getDirectory();
        if (disposed) return;
        setDraftDirectory(directory);
        if (directory) setDrafts(await draftApi.list());
      } catch (error) {
        if (!disposed) setToast(errorMessage(error));
      }
    });
    void desktopApi.getAutostart().then(setAutostart);
    void desktopApi.onTrayNewDraft(() => void createDraft()).then((stopListening) => {
      if (disposed) stopListening();
      else unlisten = stopListening;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    const systemTheme = matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const resolvedTheme = themeMode === "system" ? (systemTheme.matches ? "dark" : "light") : themeMode;
      document.documentElement.dataset.theme = resolvedTheme;
      document.documentElement.dataset.themeMode = themeMode;
    };
    applyTheme();
    systemTheme.addEventListener("change", applyTheme);
    localStorage.setItem(THEME_KEY, themeMode);
    return () => systemTheme.removeEventListener("change", applyTheme);
  }, [themeMode]);

  useEffect(() => {
    document.documentElement.classList.toggle("reduced-transparency", reducedTransparency);
    localStorage.setItem(TRANSPARENCY_KEY, String(reducedTransparency));
  }, [reducedTransparency]);

  useEffect(() => {
    const closeTransientUi = (event: PointerEvent) => {
      const target = event.target as Element;
      if (!target.closest(".settings-popover") && !target.closest(".more-button")) setSettingsOpen(false);
      if (!target.closest(".context-menu")) setContextMenu(null);
    };
    document.addEventListener("pointerdown", closeTransientUi);
    return () => document.removeEventListener("pointerdown", closeTransientUi);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 1500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function selectDraft(draftId: string) {
    setSettingsOpen(false);
    setContextMenu(null);
    try {
      if (draftApi.isNative) {
        const document = await draftApi.read(draftId);
        setDrafts((currentDrafts) => currentDrafts.map((draft) => draft.id === draftId ? document : draft));
      }
      setActiveId(draftId);
      setPreviewSide(await desktopApi.showPreview());
    } catch (error) {
      setToast(errorMessage(error));
    }
  }

  async function closePreview() {
    setActiveId(null);
    await desktopApi.hidePreview();
  }

  async function toggleCollapsed() {
    const nextCollapsed = !collapsed;
    setSettingsOpen(false);
    setActiveId(null);
    setCollapsed(nextCollapsed);
    await desktopApi.setCollapsed(nextCollapsed);
  }

  async function togglePinned(value: boolean) {
    setPinned(value);
    localStorage.setItem(PIN_KEY, String(value));
    await desktopApi.setAlwaysOnTop(value);
    setToast(value ? "已保持置顶" : "已取消置顶");
  }

  async function toggleAutostart(value: boolean) {
    try {
      await desktopApi.setAutostart(value);
      setAutostart(value);
      setToast(value ? "已开启开机启动" : "已关闭开机启动");
    } catch {
      setToast("开机启动设置失败");
    }
  }

  async function createDraft() {
    try {
      let draft: Draft;
      if (draftApi.isNative) {
        const directory = await draftApi.getDirectory();
        if (!directory && !await chooseDraftDirectory()) return;
        draft = await draftApi.create();
      } else {
        const title = uniqueBrowserTitle(drafts);
        draft = { id: `${title}.txt`, title, content: "", updatedAt: Date.now(), size: 0 };
      }
      setDrafts((currentDrafts) => [draft, ...currentDrafts]);
      setActiveId(null);
      setRenamingId(draft.id);
      setSettingsOpen(false);
    } catch (error) {
      setToast(errorMessage(error));
    }
  }

  async function finishRename(draftId: string, nextTitle: string | null) {
    const title = nextTitle?.trim().replace(/\.txt$/i, "").trim();
    if (nextTitle === null) {
      setRenamingId(null);
      return;
    }
    if (!title) {
      setToast("名称不能为空");
      setRenamingId(null);
      return;
    }
    try {
      const renamed = draftApi.isNative
        ? await draftApi.rename(draftId, title)
        : { ...drafts.find((draft) => draft.id === draftId)!, id: `${title}.txt`, title, updatedAt: Date.now() };
      setDrafts((currentDrafts) => currentDrafts.map((draft) => draft.id === draftId ? renamed : draft));
      if (activeId === draftId) setActiveId(renamed.id);
      setToast("名称已更新");
    } catch (error) {
      setToast(errorMessage(error));
    }
    setRenamingId(null);
  }

  async function copyDraft(draftId: string) {
    try {
      const draft = draftApi.isNative ? await draftApi.read(draftId) : drafts.find((item) => item.id === draftId);
      if (!draft) return;
      await navigator.clipboard.writeText(draft.content);
      setToast("已复制到剪贴板");
      setContextMenu(null);
    } catch (error) {
      setToast(errorMessage(error));
    }
  }

  async function deleteDraft(draftId: string) {
    const draft = drafts.find((item) => item.id === draftId);
    if (!draft || !confirm(`将“${draft.title}.txt”移到废纸篓吗？`)) return;
    try {
      if (draftApi.isNative) await draftApi.trash(draftId);
      setDrafts((currentDrafts) => currentDrafts.filter((item) => item.id !== draftId));
      if (activeId === draftId) void closePreview();
      setContextMenu(null);
      setToast(draftApi.isNative ? "已移到回收站" : "模拟草稿已移除");
    } catch (error) {
      setToast(errorMessage(error));
    }
  }

  function updatePreviewContent(draftId: string, content: string) {
    setDrafts((currentDrafts) => currentDrafts.map((draft) => draft.id === draftId ? { ...draft, content, size: content.length } : draft));
  }

  function updatePreviewTitle(draftId: string, title: string) {
    setDrafts((currentDrafts) => currentDrafts.map((draft) => draft.id === draftId ? { ...draft, title } : draft));
  }

  async function savePreviewTitle(draftId: string) {
    const draft = drafts.find((item) => item.id === draftId);
    const title = draft?.title.trim().replace(/\.txt$/i, "").trim();
    if (!draft || !title) {
      setToast("名称不能为空");
      return;
    }
    try {
      const renamed = draftApi.isNative
        ? await draftApi.rename(draft.id, title)
        : { ...draft, id: `${title}.txt`, title, updatedAt: Date.now() };
      setDrafts((currentDrafts) => currentDrafts.map((item) => item.id === draftId ? renamed : item));
      setActiveId((currentId) => currentId === draftId ? renamed.id : currentId);
      setToast("名称已更新");
    } catch (error) {
      setToast(errorMessage(error));
    }
  }

  async function savePreviewContent(draftId: string) {
    const draft = drafts.find((item) => item.id === draftId);
    if (!draft) return;
    try {
      if (draftApi.isNative) {
        const saved = await draftApi.save(draft.id, draft.content);
        setDrafts((currentDrafts) => currentDrafts.map((item) => item.id === draftId ? saved : item));
      }
      setToast("已保存");
    } catch (error) {
      setToast(errorMessage(error));
    }
  }

  async function chooseDraftDirectory() {
    try {
      if (!draftApi.isNative) {
        setToast("浏览器预览使用模拟草稿");
        return null;
      }
      const directory = await draftApi.chooseDirectory();
      if (!directory) return null;
      setDraftDirectory(directory);
      setDrafts(await draftApi.list());
      setActiveId(null);
      await desktopApi.hidePreview();
      setToast("草稿目录已更新");
      return directory;
    } catch (error) {
      setToast(errorMessage(error));
      return null;
    }
  }

  return (
    <main className={`workspace preview-${previewSide} ${activeDraft ? "has-preview" : ""}`}>
      <aside className={`dock ${collapsed ? "collapsed" : ""}`} aria-label="桌面草稿列表">
        <header className="dock-header" onPointerDown={(event) => {
          if (!(event.target as HTMLElement).closest("button")) void desktopApi.startDragging();
        }}>
          <div className="brand"><strong>拾笺</strong><span>{drafts.length} 个 TXT 草稿</span></div>
          <div className="header-actions">
            <button className="icon-button pin-button" aria-label={pinned ? "取消窗口置顶" : "保持窗口置顶"} aria-pressed={pinned} onClick={() => void togglePinned(!pinned)}><Icon name="pin" /></button>
            <button className="icon-button" aria-label={collapsed ? "展开草稿列表" : "收起草稿列表"} aria-expanded={!collapsed} onClick={() => void toggleCollapsed()}><Icon className={collapsed ? "rotate" : ""} name="chevron-up" /></button>
            <button className="icon-button" aria-label="新建草稿" onClick={() => void createDraft()}><Icon name="plus" /></button>
            <button className="icon-button more-button" aria-label="更多设置" aria-expanded={settingsOpen} onClick={() => setSettingsOpen((open) => !open)}><Icon name="more" /></button>
          </div>
        </header>
        {!collapsed && <>
          <div className="search-box"><Icon name="search" /><input aria-label="搜索草稿" placeholder="搜索" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          <DraftList
            activeId={contextMenu?.draftId ?? activeId}
            drafts={filteredDrafts}
            renamingId={renamingId}
            onContextMenu={(draftId, x, y) => setContextMenu({ draftId, x, y })}
            onOpenEditor={(draftId) => void selectDraft(draftId)}
            onRenameFinish={(draftId, title) => void finishRename(draftId, title)}
            onRenameStart={setRenamingId}
            onSelect={(draftId) => void selectDraft(draftId)}
          />
        </>}
        <SettingsPopover
          autostart={autostart}
          draftDirectory={draftDirectory}
          open={settingsOpen}
          pinned={pinned}
          transparencyEnabled={!reducedTransparency}
          themeMode={themeMode}
          onAutostartChange={(value) => void toggleAutostart(value)}
          onChooseFolder={() => void chooseDraftDirectory()}
          onCloseToTray={() => void desktopApi.hideToTray()}
          onPinnedChange={(value) => void togglePinned(value)}
          onTransparencyChange={(value) => { setReducedTransparency(!value); setToast(value ? "已开启透明效果" : "已关闭透明效果"); }}
          onThemeModeChange={setThemeMode}
        />
      </aside>
      {activeDraft && <Preview draft={activeDraft} onClose={closePreview} onCopy={copyDraft} onDelete={deleteDraft} onContentChange={(content) => updatePreviewContent(activeDraft.id, content)} onContentBlur={() => void savePreviewContent(activeDraft.id)} onTitleChange={(title) => updatePreviewTitle(activeDraft.id, title)} onTitleBlur={() => void savePreviewTitle(activeDraft.id)} />}
      {contextMenu && <ContextMenu menu={contextMenu} onCopy={copyDraft} onDelete={deleteDraft} onPreview={selectDraft} onRename={(draftId) => { setContextMenu(null); setRenamingId(draftId); }} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}

function Preview({ draft, onClose, onCopy, onDelete, onContentChange, onContentBlur, onTitleChange, onTitleBlur }: { draft: Draft; onClose: () => void; onCopy: (id: string) => void; onDelete: (id: string) => void; onContentChange: (content: string) => void; onContentBlur: () => void; onTitleChange: (title: string) => void; onTitleBlur: () => void }) {
  return (
    <section className="preview" aria-label="草稿预览">
      <header><div><strong>{draft.title}.txt</strong><span>{formatUpdatedAt(draft.updatedAt)} · {draft.content.length} 字符</span></div><div className="preview-actions"><button className="icon-button" aria-label="复制内容" onClick={() => void onCopy(draft.id)}><Icon name="copy" /></button><button className="icon-button" aria-label="删除草稿" onClick={() => void onDelete(draft.id)}><Icon name="trash" /></button><button className="icon-button" aria-label="关闭预览" onClick={() => void onClose()}><Icon name="x" /></button></div></header>
      <article><input className="preview-title-input" aria-label="预览标题" value={draft.title} onChange={(event) => onTitleChange(event.target.value)} onBlur={onTitleBlur} /><textarea className="preview-editor" aria-label="预览正文" value={draft.content} placeholder="这是一份空白草稿。" onChange={(event) => onContentChange(event.target.value)} onBlur={onContentBlur} /></article>
      <footer><span>标题与正文可直接编辑</span><span>{draft.content.length} 字符 · .txt</span></footer>
    </section>
  );
}

interface ContextMenuProps {
  menu: { draftId: string; x: number; y: number };
  onCopy: (id: string) => void;
  onDelete: (id: string) => void;
  onPreview: (id: string) => void;
  onRename: (id: string) => void;
}

function formatUpdatedAt(timestamp: number) {
  if (!timestamp) return "未知时间";
  const date = new Date(timestamp);
  const now = new Date();
  const time = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(date);
  if (date.toDateString() === now.toDateString()) return `今天 ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `昨天 ${time}`;
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function uniqueBrowserTitle(drafts: Draft[]) {
  const titles = new Set(drafts.map((draft) => draft.title));
  if (!titles.has("未命名草稿")) return "未命名草稿";
  let suffix = 1;
  while (titles.has(`未命名草稿 ${suffix}`)) suffix += 1;
  return `未命名草稿 ${suffix}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "操作失败");
}

function ContextMenu({ menu, onCopy, onDelete, onPreview, onRename }: ContextMenuProps) {
  const style = { left: Math.min(menu.x, window.innerWidth - 190), top: Math.min(menu.y, window.innerHeight - 235) };
  return (
    <div className="context-menu" style={style} role="menu">
      <button onClick={() => void onPreview(menu.draftId)}><Icon name="eye" />快速预览<span>Space</span></button>
      <div className="separator" />
      <button onClick={() => onRename(menu.draftId)}><Icon name="edit" />重命名<span>F2</span></button>
      <button onClick={() => void onCopy(menu.draftId)}><Icon name="copy" />复制内容<span>Ctrl+C</span></button>
      <div className="separator" />
      <button className="danger" onClick={() => onDelete(menu.draftId)}><Icon name="trash" />移到废纸篓<span>Delete</span></button>
    </div>
  );
}
