import type { Draft } from "../types";

export const initialDrafts: Draft[] = [
  { id: "Accessories.txt", title: "Accessories", content: "收集一些常用的小工具和桌面配件。\n\n后续可以在这里记录购买链接、尺寸与摆放方式。", updatedAt: Date.now() - 20_000, size: 98 },
  { id: "CC Switch.txt", title: "CC Switch", content: "切换配置时需要检查的事项：\n\n1. 本地环境变量\n2. 代理状态\n3. 默认工作目录", updatedAt: Date.now() - 900_000, size: 88 },
  { id: "Clash Verge.txt", title: "Clash Verge", content: "代理配置备忘。\n\n更新订阅后检查节点延迟，工作模式保持规则模式。", updatedAt: Date.now() - 86_400_000, size: 75 },
  { id: "Codex++.txt", title: "Codex++", content: "桌面 TXT 草稿架想法：\n\n单击打开贴合预览，双击进入完整编辑窗口。", updatedAt: Date.now() - 172_800_000, size: 82 },
  { id: "docker-desktop.txt", title: "docker-desktop", content: "容器启动清单与常用命令速记。", updatedAt: Date.now() - 259_200_000, size: 40 },
  { id: "Flow Launcher.txt", title: "Flow Launcher", content: "自定义快捷搜索：项目、笔记、命令以及最近使用的目录。", updatedAt: Date.now() - 345_600_000, size: 60 },
  { id: "Maintenance.txt", title: "Maintenance", content: "每月维护：清理下载目录、整理截图、检查备份。", updatedAt: Date.now() - 432_000_000, size: 52 },
  { id: "MSYS2.txt", title: "MSYS2", content: "开发环境安装记录与常用包。", updatedAt: Date.now() - 518_400_000, size: 36 },
];
