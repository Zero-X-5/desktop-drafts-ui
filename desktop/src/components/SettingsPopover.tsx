import { Icon } from "./Icon";
import type { ThemeMode } from "../types";

interface SettingsPopoverProps {
  autostart: boolean;
  draftDirectory: string | null;
  open: boolean;
  pinned: boolean;
  transparencyEnabled: boolean;
  themeMode: ThemeMode;
  onAutostartChange: (value: boolean) => void;
  onChooseFolder: () => void;
  onCloseToTray: () => void;
  onPinnedChange: (value: boolean) => void;
  onTransparencyChange: (value: boolean) => void;
  onThemeModeChange: (value: ThemeMode) => void;
}

export function SettingsPopover(props: SettingsPopoverProps) {
  if (!props.open) return null;

  return (
    <section className="settings-popover" aria-label="拾笺设置">
      <header className="settings-head"><strong>设置</strong><span>显示与行为</span></header>
      <span className="settings-label">外观</span>
      <div className="theme-segmented" role="group" aria-label="外观主题">
        {(["system", "light", "dark"] as const).map((mode) => (
          <button key={mode} aria-pressed={props.themeMode === mode} onClick={() => props.onThemeModeChange(mode)}>
            {{ system: "自动", light: "浅色", dark: "深色" }[mode]}
          </button>
        ))}
      </div>
      <SettingSwitch icon="pin" label="保持置顶" detail="始终显示在其他窗口上方" checked={props.pinned} onChange={props.onPinnedChange} />
      <SettingSwitch icon="power" label="开机时启动" detail="登录后自动显示拾笺" checked={props.autostart} onChange={props.onAutostartChange} />
      <SettingSwitch icon="eye" label="透明效果" detail="允许背景透过面板" checked={props.transparencyEnabled} onChange={props.onTransparencyChange} />
      <button className="settings-row" onClick={props.onChooseFolder}>
        <Icon name="folder" /><span><strong>草稿目录</strong><small title={props.draftDirectory || undefined}>{directoryLabel(props.draftDirectory)}</small></span><Icon name="chevron-right" />
      </button>
      <div className="separator" />
      <button className="settings-row danger" onClick={props.onCloseToTray}>
        <Icon name="x" /><span><strong>关闭到托盘</strong><small>草稿仍会自动保存</small></span><span />
      </button>
    </section>
  );
}

function directoryLabel(directory: string | null) {
  if (!directory) return "选择一个 TXT 文件夹";
  return directory.split(/[\\/]/).filter(Boolean).at(-1) || directory;
}

interface SettingSwitchProps {
  checked: boolean;
  detail: string;
  icon: "eye" | "pin" | "power";
  label: string;
  onChange: (value: boolean) => void;
}

function SettingSwitch({ checked, detail, icon, label, onChange }: SettingSwitchProps) {
  return (
    <button className="settings-row" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}>
      <Icon name={icon} /><span><strong>{label}</strong><small>{detail}</small></span><i className="switch" />
    </button>
  );
}
