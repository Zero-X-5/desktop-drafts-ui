# Contributing to Shijian

Thanks for considering a contribution to Shijian.

## Before you start

For small bug fixes, documentation improvements or isolated UI tweaks, a Pull Request is welcome directly.

For larger behavior or architecture changes, please open an Issue first so the direction can be discussed before implementation.

## Development setup

Requirements:

- Windows 10 / 11
- Node.js 18+
- Rust stable
- Tauri 2 Windows build prerequisites

```bash
git clone https://github.com/Zero-X-5/desktop-drafts-ui.git
cd desktop-drafts-ui
npm install
npm run tauri dev
```

Build the application with:

```bash
npm run tauri build
```

For Rust-only checks:

```bash
cd src-tauri
cargo check --locked
```

## Repository rules

Before changing code, read:

1. `STATUS.md`
2. `CODEMAP.md`
3. `AGENTS.md`
4. `DESIGN.md` when changing UI

Important window architecture constraints:

- Keep a single native window, single WebView and single DOM.
- The native canvas remains fixed at 720×480.
- Windows uses native Region clipping for collapsed / expanded / preview states.
- Do not reintroduce runtime `win.setSize` / `win.onResized` state transitions.
- Do not replace the current Region timing with opaque full-window masks.

## Pull Requests

Please keep changes focused and avoid unrelated refactors.

Before submitting:

- Run the checks directly relevant to your change.
- For Rust or Tauri changes, run `cargo check --locked`.
- For release-impacting changes, run `npm run tauri build` on Windows when possible.
- Test light / dark / transparent modes when UI is affected.
- Test relevant DPI and multi-monitor behavior when window positioning or Region code is affected.
- Update documentation when behavior, architecture or usage changes.

## Commit messages

Prefer focused commit messages in the existing style, for example:

```text
fix: stabilize preview side switching
docs: clarify local storage behavior
feat: add draft search shortcut
```

## Reporting bugs

Use the GitHub bug report template and include reproduction steps, Windows version, display scaling and whether multiple monitors are involved when relevant.

## Security issues

Please follow `SECURITY.md` for security-sensitive reports.
