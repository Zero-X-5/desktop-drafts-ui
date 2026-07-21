export type ThemeMode = "system" | "light" | "dark";
export type PreviewSide = "left" | "right";

export interface Draft {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
  size: number;
}
