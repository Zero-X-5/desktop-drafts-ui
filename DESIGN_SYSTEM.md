# 拾笺界面设计系统

这份规范只提炼当前桌面 TXT 便签需要的 Apple 设计原则，不照搬与项目无关的移动端导航、游戏或空间界面模式。

## 1. 产品模型

- 主列表是常驻桌面的轻量工具，不模拟完整 Finder 窗口。
- 单击选中并打开相邻预览，双击直接进入完整编辑器。
- 预览从主列表内侧连续展开，顶部、底部和材质保持一致。
- 列表默认停靠屏幕右侧，也允许移动到左侧。
- 编辑器承担长时间输入，预览只承担阅读和快速操作。

## 2. 视觉层级

1. 桌面背景属于内容环境。
2. 主列表和预览外壳使用一层连续的半透明材质。
3. 正文内容不额外叠加玻璃卡片，避免多层模糊。
4. 完整编辑器使用较实的窗口材质，保证长文本可读性。
5. 阴影只表达窗口悬浮关系，不作为装饰。

## 3. 几何与间距

- 外侧窗口圆角：12px。
- 列表项、搜索框和普通按钮：6–7px。
- 列表与预览连接处：0–3px，并重叠 1px 消除双边框。
- 工具栏高度：52–54px。
- 列表项最小高度：42px。
- 图标点击区域不小于 28px，图标本体约 14–16px。
- 正文保持明显留白，单行宽度避免过长。

## 4. 字体

- 优先系统字体：`-apple-system`、`BlinkMacSystemFont`，其他平台使用 Inter 等兼容字体。
- 正文使用 Regular，文件名使用 Medium，标题和关键按钮使用 Semibold。
- 避免 Thin 和 Light，以保证透明背景上的辨识度。
- 通过字号、字重和次级文字颜色建立层级，不滥用颜色。

## 5. 颜色

- 主文字使用系统标签色语义，次级信息降低不透明度。
- 蓝色仅用于选中状态、键盘焦点和主要操作。
- 删除按钮默认保持中性，悬停或确认阶段才显示红色语义。
- 同时支持浅色、深色和增强对比度环境。
- 不只依靠颜色表达选中状态，还要保留背景、字重或图标变化。

## 6. 图标与按钮

- 图标采用与 SF Symbols 接近的统一线性语言。
- 常用操作使用熟悉映射：新建 `plus`、编辑 `square.and.pencil`、复制 `doc.on.doc`、删除 `trash`、关闭 `xmark`。
- 工具栏按钮默认无独立灰色方块，只在悬停和按下时显现背景。
- 图标按钮必须提供 `aria-label` 和悬停提示。
- 文字按钮使用简短动词，例如“编辑”和“完成”。

## 7. 动效

- 预览从触发列表的方向展开，保持来源关系。
- 动画控制在约 160–220ms，使用柔和减速曲线。
- 不用弹跳或大幅缩放，避免干扰桌面工作。
- 用户选择减少动态效果时，关闭位移和缩放动画。

## 8. 可访问性

- 键盘可完成搜索、选择、预览、编辑和关闭。
- 焦点环始终可见。
- 支持 `prefers-reduced-transparency`、`prefers-contrast`、`prefers-reduced-motion`。
- 透明材质失效时自动回退为高可读的不透明背景。

## 9. 当前不优先

- App 图标和 Icon Composer。
- iOS 标签栏、底部工具栏和触摸手势。
- visionOS 景深与空间布局。
- 复杂多栏文件管理、云同步和协作状态。

## 10. 桌面交互约定

- 方向键移动列表选择，`Space` 打开预览，`Enter` 打开编辑器。
- `Ctrl/Command + N` 新建，`Ctrl/Command + F` 搜索，`Ctrl/Command + S` 保存。
- `F2` 重命名，`Delete` 删除，`Escape` 关闭当前浮层。
- 右键菜单只提供当前文件相关操作，并在屏幕边缘自动调整位置。
- 右键首先选中文件，但不强制打开预览，避免打断用户当前动作。
- 菜单项使用图标、动词和快捷键提示，危险操作单独分组并使用红色语义。

## 11. 完整编辑窗口

- 完整编辑采用独立窗口语义，不用强烈遮罩制造阻断感。
- 工具栏与标题栏融合：左侧放窗口控制和侧栏开关，中间显示文档名与保存状态。
- 正文属于内容层，使用稳定、不透明且高可读的背景，不叠加 Liquid Glass。
- 侧栏只承载位置和筛选，可随窗口缩小自动隐藏，也允许用户主动隐藏。
- 关闭、最小化和缩放遵循桌面窗口习惯；自动保存，不在底部放置关键“完成”操作。
- 正文限制舒适行宽，并保留充分的编辑留白。

## 12. 浅色与深色主题

- 浅色主题采用接近 Finder 与 Notes 的高明度实体卡片，阴影轻、分隔弱。
- 深色主题采用接近 Xcode 与 Pro App 的中性黑灰，不使用纯黑大面积背景。
- 两套主题分别定义材质、边框、阴影、正文颜色和悬停状态，不使用简单反色。
- 蓝色选中态在两种主题中保持一致语义，选中文字和图标统一使用白色。
- 默认跟随系统外观，用户手动切换后记住选择。
- 外观选择收进设置弹层，以“自动 / 浅色 / 深色”分段控件呈现，并提供 `Ctrl/Command + Shift + L` 快捷键。

## 13. 桌面窗口状态

- 主悬浮窗可以在桌面可用区域内自由移动，不强制停靠左右边缘。
- 记住窗口最后位置，并在显示器尺寸变化后自动限制回可见区域。
- 收起只保留标题栏，便于临时减少干扰；再次点击恢复列表。
- 关闭主窗等同于隐藏到系统托盘，不直接退出或丢失草稿。
- 预览根据窗口周围剩余空间自动选择左侧或右侧，并保持顶部对齐。

## 14. 置顶与设置弹层

- 标题栏只保留置顶、收起、新建和更多四个高频入口，关闭等低频操作收进更多菜单。
- 置顶状态在标题栏与设置弹层中保持同步，并记住用户选择。
- 设置弹层使用紧凑分组，包含外观、开机启动、透明度、默认目录与关闭到托盘。
- 降低透明度属于可访问性选项，应提升背景不透明度并停用模糊效果。
- HTML 原型只模拟置顶、开机启动和目录选择；桌面版本由原生窗口与系统 API 执行。

## 官方依据

- [Apple Design](https://developer.apple.com/cn/design/)
- [Designing for macOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-macos/)
- [Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
- [Layout](https://developer.apple.com/design/human-interface-guidelines/layout)
- [Typography](https://developer.apple.com/design/human-interface-guidelines/typography)
- [Color](https://developer.apple.com/design/human-interface-guidelines/color)
- [SF Symbols](https://developer.apple.com/design/human-interface-guidelines/sf-symbols)
- [Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)
- [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
