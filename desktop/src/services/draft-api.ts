import { invoke } from "@tauri-apps/api/core";
import type { Draft } from "../types";
import { desktopApi } from "./desktop-api";

type DraftSummary = Omit<Draft, "content">;

export const draftApi = {
  isNative: desktopApi.isNative,

  getDirectory() {
    return invoke<string | null>("get_draft_directory");
  },

  chooseDirectory() {
    return invoke<string | null>("choose_draft_directory");
  },

  async list(): Promise<Draft[]> {
    const drafts = await invoke<DraftSummary[]>("list_drafts");
    return drafts.map((draft) => ({ ...draft, content: "" }));
  },

  read(fileName: string) {
    return invoke<Draft>("read_draft", { fileName });
  },

  create() {
    return invoke<Draft>("create_draft");
  },

  rename(fileName: string, title: string) {
    return invoke<Draft>("rename_draft", { fileName, title });
  },

  save(fileName: string, content: string) {
    return invoke<Draft>("save_draft", { fileName, content });
  },

  trash(fileName: string) {
    return invoke<void>("trash_draft", { fileName });
  },
};
