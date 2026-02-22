# 2026-02-22 — Toolbar Polish

## What Happened

Batch of UX improvements to the mixer toolbar: independent mute-all, cleaner trash/save interactions, persistent piece selection, layout tweaks.

### Independent Mute-All
- Mute-all (M) now snapshots per-track mute state before engaging
- Disengaging restores the snapshot — manually muted tracks stay muted
- Uses `preMuteRef` to hold the snapshot across the toggle

### Trash Icon
- No longer swaps to "confirm?" text — icon stays, just turns red when armed
- Same 2-click + 3s timeout behavior underneath

### Seamless Save
- Replaced native `prompt()` with inline text input
- Click floppy disk icon → piece selector morphs into editable input, pre-filled with current name
- Enter = save (same name = overwrite, new name = save-as), Escape/blur = cancel
- Second click on floppy disk also confirms (double-tap = quick overwrite)
- Floppy disk icon goes red when input is active
- `onMouseDown preventDefault` on button prevents blur race condition

### Persistent Piece Selection
- `currentPiece` now stored in `mixState` (persists to SQLite via state merge)
- Server sets `mixState.currentPiece` on piece load
- Dropdown shows current piece after page reload
- Fixed duplicate piece in dropdown — filter `currentPiece` from options list since it's already the default label

### Layout
- BPM input moved to right zone (next to connection dot)
- Astro dev toolbar disabled

## Debugging Note
- Spent time debugging `currentPiece` not persisting — turned out `pkill` wasn't killing the old server process. The port was held by a zombie. Fixed restart command to use `lsof -ti:4322 | xargs kill -9`.
- Used `sendDebug()` over WebSocket to `playground.debug` instead of console.log — much better for server-side visibility.

## Files Changed
```
CLAUDE.md                                   (debug docs, restart command fix)
sync-server.mjs                             (currentPiece on piece load)
website/astro.config.mjs                    (disable dev toolbar)
website/src/repl/Mixer.jsx                  (independent mute-all, save handler, currentPiece persistence)
website/src/repl/Repl.css                   (save input styles)
website/src/repl/components/MixerToolbar.jsx (trash icon, floppy save, inline input, BPM moved, dropdown blur)
```
