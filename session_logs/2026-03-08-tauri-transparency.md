# 2026-03-08 — Tauri app with transparent background

## What happened
- Mixer page wasn't loading in browser — turned out to be Vite "504 Outdated Optimize Dep" error from stale dep cache. Fixed by clearing `website/node_modules/.vite` and restarting.
- Jura wanted the mixer visualization background to be fully transparent (see-through to desktop). Regular browsers can't do this — discussed Electron vs Tauri, went with Tauri for the smaller footprint.
- Set up a minimal Tauri v2 app (`src-tauri/`) that loads `http://localhost:4321/mixer` in a native window with `transparent: true` and `macOSPrivateApi: true`.
- Added a transparency toggle ("T" knob) to the mixer toolbar. When active, body and CSS vars switch to transparent/translucent values so the desktop shows through the viz area while toolbar and track panels stay semi-opaque.

## Technical decisions
- **Tauri over Electron** — uses system WebView (WKWebView on macOS), ~5MB vs ~150MB. macOS WebView supports transparent backgrounds natively.
- **CSS-based transparency** — toggle flips `document.body.style.background` to `transparent` and adjusts `--mixer-bg` and `--mixer-panel` CSS vars to `rgba()` values with 0.7/0.75 alpha. No Tauri IPC needed.
- **Keyboard shortcut** — T key toggles transparency (alongside existing V for viz, P for play, M for mute-all).

## Files added
- `src-tauri/` — full Tauri v2 project (Cargo.toml, tauri.conf.json, src/main.rs, icons/)

## Files changed
- `website/src/repl/Mixer.jsx` — added `transparentBg` state, useEffect for CSS toggling, T keyboard shortcut
- `website/src/repl/components/MixerToolbar.jsx` — added T knob button, new props

## Next steps
- Consider `pnpm tauri dev` script in package.json for convenience
- Could add window drag region to toolbar (frameless mode)
- Icon is placeholder orange square — could make a proper one
