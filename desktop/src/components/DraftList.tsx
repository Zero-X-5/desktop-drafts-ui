import { useEffect, useRef } from "react";
import { Icon } from "./Icon";
import type { Draft } from "../types";

interface DraftListProps {
  activeId: string | null;
  drafts: Draft[];
  renamingId: string | null;
  onContextMenu: (draftId: string, x: number, y: number) => void;
  onOpenEditor: (draftId: string) => void;
  onRenameFinish: (draftId: string, title: string | null) => void;
  onRenameStart: (draftId: string) => void;
  onSelect: (draftId: string) => void;
}

export function DraftList(props: DraftListProps) {
  return (
    <section className="draft-list" aria-label="TXT 文件">
      {props.drafts.length === 0 && <div className="draft-empty"><Icon name="file" /><strong>这里还没有草稿</strong><span>点击顶部的加号新建 TXT</span></div>}
      {props.drafts.map((draft) => (
        <article
          className={`draft-row ${props.activeId === draft.id ? "selected" : ""}`}
          key={draft.id}
          tabIndex={0}
          onClick={() => props.onSelect(draft.id)}
          onDoubleClick={() => props.onOpenEditor(draft.id)}
          onContextMenu={(event) => {
            event.preventDefault();
            props.onContextMenu(draft.id, event.clientX, event.clientY);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") props.onOpenEditor(draft.id);
            if (event.key === "F2") props.onRenameStart(draft.id);
            if (event.key === " ") {
              event.preventDefault();
              props.onSelect(draft.id);
            }
          }}
        >
          <Icon className="draft-icon" name="file" />
          {props.renamingId === draft.id ? (
            <RenameInput draft={draft} onFinish={props.onRenameFinish} />
          ) : <span className="draft-title">{draft.title}</span>}
          <small>TXT</small>
        </article>
      ))}
    </section>
  );
}

function RenameInput({ draft, onFinish }: { draft: Draft; onFinish: DraftListProps["onRenameFinish"] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const finishedRef = useRef(false);

  useEffect(() => inputRef.current?.select(), []);

  const finish = (title: string | null) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinish(draft.id, title);
  };

  return (
    <input
      ref={inputRef}
      className="rename-input"
      aria-label={`重命名 ${draft.title}`}
      defaultValue={draft.title}
      onBlur={(event) => finish(event.currentTarget.value)}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") finish(event.currentTarget.value);
        if (event.key === "Escape") finish(null);
      }}
    />
  );
}
