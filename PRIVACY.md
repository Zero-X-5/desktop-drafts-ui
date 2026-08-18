# Privacy

Shijian is designed as a local-first desktop application.

## Draft contents

Drafts are stored as UTF-8 `.txt` files in the local directory selected by the user. On first launch, the default directory is the system Documents directory under a `拾笺` subfolder.

The application does not require an account and does not intentionally send draft contents to a remote server.

## Settings

Application settings are stored locally in Tauri's application configuration directory.

Settings can include:

- draft storage directory
- always-on-top preference
- startup preference
- global shortcut preference
- auto-save preference
- transparency preference
- pinned draft state

## File watching

Shijian watches the selected local draft directory for filesystem changes so it can react when files are modified by another application.

## Network access

The core application does not need network access for normal draft editing. Third-party services are not required for storing or reading drafts.

## Deletion

When deleting a draft through Shijian, the application uses the operating system's recycle-bin mechanism rather than permanently deleting the file directly.

## Future changes

If a future feature introduces optional online services, telemetry, synchronization or crash reporting, this document should be updated before that feature is released.
