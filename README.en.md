# Shijian 拾笺

> A lightweight, fast, local-first TXT drafts app for Windows.

[中文](./README.md)

Shijian is designed for quick notes, temporary text, code snippets and everyday drafts. It reads and writes plain UTF-8 `.txt` files directly, without accounts, cloud databases or proprietary document formats.

The current version is built with **Tauri 2 + Rust + Vanilla JavaScript/CSS** and is Windows-first.

## Features

- **Local-first** — drafts are plain UTF-8 `.txt` files.
- **Quick access** — global shortcuts and a system tray icon.
- **Auto save** — edits are written directly to local files.
- **External change awareness** — watches the drafts directory for updates from other editors.
- **Recycle Bin deletion** — deleted drafts are sent to the system Recycle Bin.
- **Light / dark themes** — with an optional transparent glass mode.
- **Adaptive preview side** — the preview automatically changes side near screen edges.
- **Multi-DPI / multi-monitor handling** — window clipping and coordinates are optimized for Windows.
- **No frontend framework** — the UI is plain HTML, CSS and JavaScript.

## Screenshots

<table>
<tr>
<td><img src="./docs/images/shijian-light.webp" alt="Shijian light-mode app screenshot" width="100%"></td>
<td><img src="./docs/images/shijian-dark.webp" alt="Shijian dark-mode app screenshot" width="100%"></td>
</tr>
<tr>
<td align="center">Light mode</td>
<td align="center">Dark mode</td>
</tr>
</table>

> Screenshots are captured from the actual Windows application.

## Installation

### Download a release

After the first public release, Windows installers will be available from GitHub Releases.

### Build from source

Requirements:

- Windows 10 / 11
- Node.js 18+
- Rust stable
- The Windows build prerequisites required by Tauri 2

```bash
git clone https://github.com/Zero-X-5/desktop-drafts-ui.git
cd desktop-drafts-ui
npm install
npm run tauri build
```

Development mode:

```bash
npm run tauri dev
```

## Default shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl + Shift + Space` | Show / hide Shijian |
| `Ctrl + Shift + N` | Create a new draft |

The shortcuts can be disabled in Settings.

## Data and privacy

Shijian does not require an account and does not intentionally upload draft contents.

Drafts are stored in a local directory selected by the user. On first launch, the default location is a `拾笺` folder inside the system Documents directory. Settings are stored in Tauri's application config directory.

See [PRIVACY.md](./PRIVACY.md) for details.

## Tech stack

- [Tauri 2](https://tauri.app/)
- Rust
- Vanilla JavaScript
- Vanilla CSS
- Windows API (`SetWindowRgn`) for DPI-aware native rounded window clipping

## Repository layout

```text
.
├── src/                  # frontend HTML / CSS / JavaScript
├── src-tauri/            # Rust / Tauri backend
├── docs/images/          # project showcase images
├── AGENTS.md             # development protocol
├── CODEMAP.md            # code map
├── DESIGN.md             # UI design rules
├── STATUS.md             # current project state
└── .github/              # issues, PRs, CI and release automation
```

## Contributing

Bug reports, feature proposals and pull requests are welcome.

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before contributing.

## Roadmap

- [ ] Publish the first downloadable Windows `v0.1.0`
- [x] Add real light / dark application screenshots
- [ ] Improve search and multi-draft interactions
- [ ] Expand automated test coverage
- [ ] Iterate based on real user feedback

## Security

For security issues, please follow [SECURITY.md](./SECURITY.md) rather than posting sensitive details publicly.

## License

[MIT](./LICENSE)
