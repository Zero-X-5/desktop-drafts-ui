use serde::{Deserialize, Serialize};
use std::{
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::{Component, Path, PathBuf},
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::{DialogExt, FilePath};

const DEFAULT_TITLE: &str = "未命名草稿";
const MAX_TITLE_LENGTH: usize = 120;

#[derive(Default, Deserialize, Serialize)]
struct DraftSettings {
    draft_directory: Option<PathBuf>,
}

pub struct DraftState {
    root: Mutex<Option<PathBuf>>,
    settings_path: PathBuf,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DraftSummary {
    id: String,
    title: String,
    updated_at: u64,
    size: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DraftDocument {
    id: String,
    title: String,
    content: String,
    updated_at: u64,
    size: u64,
}

impl DraftState {
    pub fn load(app: &AppHandle) -> Result<Self, String> {
        let settings_path = app
            .path()
            .app_config_dir()
            .map_err(|error| error.to_string())?
            .join("settings.json");
        let settings = read_settings(&settings_path).unwrap_or_default();
        let root = settings
            .draft_directory
            .filter(|path| path.is_dir())
            .and_then(|path| path.canonicalize().ok());

        Ok(Self {
            root: Mutex::new(root),
            settings_path,
        })
    }

    fn root(&self) -> Result<PathBuf, String> {
        self.root
            .lock()
            .map_err(|_| "草稿目录状态不可用".to_string())?
            .clone()
            .ok_or_else(|| "请先选择草稿目录".to_string())
    }

    fn set_root(&self, root: PathBuf) -> Result<(), String> {
        let settings = DraftSettings {
            draft_directory: Some(root.clone()),
        };
        write_settings(&self.settings_path, &settings)?;
        *self
            .root
            .lock()
            .map_err(|_| "草稿目录状态不可用".to_string())? = Some(root);
        Ok(())
    }
}

#[tauri::command]
pub fn get_draft_directory(state: State<'_, DraftState>) -> Result<Option<String>, String> {
    let root = state
        .root
        .lock()
        .map_err(|_| "草稿目录状态不可用".to_string())?;
    Ok(root.as_ref().map(|path| path.to_string_lossy().into_owned()))
}

#[tauri::command]
pub fn choose_draft_directory(
    app: AppHandle,
    state: State<'_, DraftState>,
) -> Result<Option<String>, String> {
    let Some(selected) = app.dialog().file().blocking_pick_folder() else {
        return Ok(None);
    };
    let path = match selected {
        FilePath::Path(path) => path,
        FilePath::Url(_) => return Err("请选择本地文件夹".to_string()),
    };
    let root = path.canonicalize().map_err(|error| error.to_string())?;
    if !root.is_dir() {
        return Err("选择的路径不是文件夹".to_string());
    }
    state.set_root(root.clone())?;
    Ok(Some(root.to_string_lossy().into_owned()))
}

#[tauri::command]
pub fn list_drafts(state: State<'_, DraftState>) -> Result<Vec<DraftSummary>, String> {
    list_in_root(&state.root()?)
}

#[tauri::command]
pub fn read_draft(file_name: String, state: State<'_, DraftState>) -> Result<DraftDocument, String> {
    read_in_root(&state.root()?, &file_name)
}

#[tauri::command]
pub fn create_draft(state: State<'_, DraftState>) -> Result<DraftDocument, String> {
    create_in_root(&state.root()?)
}

#[tauri::command]
pub fn rename_draft(
    file_name: String,
    title: String,
    state: State<'_, DraftState>,
) -> Result<DraftDocument, String> {
    rename_in_root(&state.root()?, &file_name, &title)
}

#[tauri::command]
pub fn save_draft(
    file_name: String,
    content: String,
    state: State<'_, DraftState>,
) -> Result<DraftDocument, String> {
    save_in_root(&state.root()?, &file_name, &content)
}

#[tauri::command]
pub fn trash_draft(file_name: String, state: State<'_, DraftState>) -> Result<(), String> {
    let path = resolve_file(&state.root()?, &file_name)?;
    if !path.is_file() {
        return Err("草稿不存在".to_string());
    }
    trash::delete(path).map_err(|error| format!("无法移到回收站：{error}"))
}

fn read_settings(path: &Path) -> Result<DraftSettings, String> {
    if !path.exists() {
        return Ok(DraftSettings::default());
    }
    let content = fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str(&content).map_err(|error| error.to_string())
}

fn write_settings(path: &Path, settings: &DraftSettings) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let content = serde_json::to_vec_pretty(settings).map_err(|error| error.to_string())?;
    safe_replace(path, &content)
}

fn list_in_root(root: &Path) -> Result<Vec<DraftSummary>, String> {
    let mut drafts = fs::read_dir(root)
        .map_err(|error| error.to_string())?
        .filter_map(Result::ok)
        .filter_map(|entry| summary_from_path(&entry.path()).ok())
        .collect::<Vec<_>>();
    drafts.sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
    Ok(drafts)
}

fn read_in_root(root: &Path, file_name: &str) -> Result<DraftDocument, String> {
    let path = resolve_file(root, file_name)?;
    let mut content = String::new();
    File::open(&path)
        .and_then(|mut file| file.read_to_string(&mut content))
        .map_err(|error| format!("无法读取 UTF-8 草稿：{error}"))?;
    document_from_path(&path, content)
}

fn create_in_root(root: &Path) -> Result<DraftDocument, String> {
    for suffix in 0..10_000 {
        let title = if suffix == 0 {
            DEFAULT_TITLE.to_string()
        } else {
            format!("{DEFAULT_TITLE} {suffix}")
        };
        let path = root.join(format!("{title}.txt"));
        match OpenOptions::new().write(true).create_new(true).open(&path) {
            Ok(mut file) => {
                file.flush().map_err(|error| error.to_string())?;
                return document_from_path(&path, String::new());
            }
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(error.to_string()),
        }
    }
    Err("未命名草稿数量过多".to_string())
}

fn rename_in_root(root: &Path, file_name: &str, title: &str) -> Result<DraftDocument, String> {
    let source = resolve_file(root, file_name)?;
    let normalized_title = normalize_title(title)?;
    let target = root.join(format!("{normalized_title}.txt"));
    if source != target && target.exists() {
        return Err("同名草稿已存在".to_string());
    }
    fs::rename(&source, &target).map_err(|error| error.to_string())?;
    read_in_root(root, target.file_name().unwrap_or_default().to_string_lossy().as_ref())
}

fn save_in_root(root: &Path, file_name: &str, content: &str) -> Result<DraftDocument, String> {
    let path = resolve_file(root, file_name)?;
    if !path.is_file() {
        return Err("草稿不存在".to_string());
    }
    safe_replace(&path, content.as_bytes())?;
    document_from_path(&path, content.to_string())
}

fn safe_replace(path: &Path, content: &[u8]) -> Result<(), String> {
    let parent = path.parent().ok_or_else(|| "目标路径无效".to_string())?;
    let file_name = path
        .file_name()
        .ok_or_else(|| "目标文件名无效".to_string())?
        .to_string_lossy();
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let temporary = parent.join(format!(".{file_name}.{nonce}.tmp"));
    let backup = parent.join(format!(".{file_name}.{nonce}.backup"));

    let result = (|| -> Result<(), String> {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)
            .map_err(|error| error.to_string())?;
        file.write_all(content).map_err(|error| error.to_string())?;
        file.sync_all().map_err(|error| error.to_string())?;

        if path.exists() {
            fs::rename(path, &backup).map_err(|error| error.to_string())?;
        }
        if let Err(error) = fs::rename(&temporary, path) {
            if backup.exists() {
                let _ = fs::rename(&backup, path);
            }
            return Err(error.to_string());
        }
        if backup.exists() {
            fs::remove_file(&backup).map_err(|error| error.to_string())?;
        }
        Ok(())
    })();

    if temporary.exists() {
        let _ = fs::remove_file(temporary);
    }
    result
}

fn resolve_file(root: &Path, file_name: &str) -> Result<PathBuf, String> {
    validate_file_name(file_name)?;
    Ok(root.join(file_name))
}

fn validate_file_name(file_name: &str) -> Result<(), String> {
    let path = Path::new(file_name);
    if path.components().count() != 1 || !matches!(path.components().next(), Some(Component::Normal(_))) {
        return Err("草稿文件名无效".to_string());
    }
    if path.extension().and_then(|value| value.to_str()).map(|value| value.eq_ignore_ascii_case("txt")) != Some(true) {
        return Err("仅支持 TXT 文件".to_string());
    }
    Ok(())
}

fn normalize_title(title: &str) -> Result<String, String> {
    let trimmed = title.trim();
    let extension_start = trimmed.len().saturating_sub(4);
    let without_extension = if trimmed
        .get(extension_start..)
        .is_some_and(|extension| extension.eq_ignore_ascii_case(".txt"))
    {
        &trimmed[..trimmed.len() - 4]
    } else {
        trimmed
    };
    let normalized = without_extension.trim();
    if normalized.is_empty() {
        return Err("名称不能为空".to_string());
    }
    if normalized.chars().count() > MAX_TITLE_LENGTH {
        return Err(format!("名称不能超过 {MAX_TITLE_LENGTH} 个字符"));
    }
    if normalized.chars().any(|character| character.is_control() || "<>:\"/\\|?*".contains(character))
        || normalized.ends_with(['.', ' '])
    {
        return Err("名称包含 Windows 不允许的字符".to_string());
    }
    let uppercase = normalized
        .split('.')
        .next()
        .unwrap_or_default()
        .to_ascii_uppercase();
    let reserved = matches!(uppercase.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || (uppercase.len() == 4
            && matches!(&uppercase[..3], "COM" | "LPT")
            && matches!(uppercase.as_bytes()[3], b'1'..=b'9'));
    if reserved {
        return Err("名称是 Windows 保留名称".to_string());
    }
    Ok(normalized.to_string())
}

fn summary_from_path(path: &Path) -> Result<DraftSummary, String> {
    validate_file_name(path.file_name().unwrap_or_default().to_string_lossy().as_ref())?;
    let metadata = path.metadata().map_err(|error| error.to_string())?;
    if !metadata.is_file() {
        return Err("不是文件".to_string());
    }
    let id = path.file_name().unwrap_or_default().to_string_lossy().into_owned();
    let title = path.file_stem().unwrap_or_default().to_string_lossy().into_owned();
    let updated_at = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map_or(0, |duration| duration.as_millis() as u64);
    Ok(DraftSummary {
        id,
        title,
        updated_at,
        size: metadata.len(),
    })
}

fn document_from_path(path: &Path, content: String) -> Result<DraftDocument, String> {
    let summary = summary_from_path(path)?;
    Ok(DraftDocument {
        id: summary.id,
        title: summary.title,
        content,
        updated_at: summary.updated_at,
        size: summary.size,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn validates_file_names_without_allowing_paths() {
        assert!(validate_file_name("草稿.txt").is_ok());
        assert!(validate_file_name("../草稿.txt").is_err());
        assert!(validate_file_name("folder/草稿.txt").is_err());
        assert!(validate_file_name("草稿.md").is_err());
    }

    #[test]
    fn normalizes_safe_windows_titles() {
        assert_eq!(normalize_title("  计划.txt  ").unwrap(), "计划");
        assert_eq!(normalize_title("计划.TXT").unwrap(), "计划");
        assert!(normalize_title("CON").is_err());
        assert!(normalize_title("CON.notes").is_err());
        assert!(normalize_title("bad:name").is_err());
        assert!(normalize_title("").is_err());
    }

    #[test]
    fn creates_renames_and_safely_saves_drafts() {
        let directory = tempdir().unwrap();
        let created = create_in_root(directory.path()).unwrap();
        let renamed = rename_in_root(directory.path(), &created.id, "工作计划").unwrap();
        let saved = save_in_root(directory.path(), &renamed.id, "第一行\n第二行").unwrap();

        assert_eq!(saved.title, "工作计划");
        assert_eq!(saved.content, "第一行\n第二行");
        assert_eq!(fs::read_to_string(directory.path().join("工作计划.txt")).unwrap(), saved.content);
        assert_eq!(list_in_root(directory.path()).unwrap().len(), 1);
    }
}
