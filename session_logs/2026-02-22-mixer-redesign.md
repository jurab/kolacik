# 2026-02-22 — Mixer UI Redesign

## What Happened

Full visual redesign of the mixer UI, bringing it in line with Jura's design language from poems/voidchat: near-black, grayscale, text-based controls, content as the star.

### Design System
- New CSS variables (`--mixer-bg`, `--mixer-panel`, `--mixer-text`, etc.) in Repl.css
- Utility classes: `.mixer-btn` (text-only), `.mixer-select` (transparent), `.mixer-knob` (round protruding buttons), `.mixer-track-controls` (hover-reveal)
- Palette: `#0a0a0a` body, `#111` panels, `#222` borders, `#c9c9c9` text hierarchy, `#f80` accent, `#6a8` status green
- Operator Mono SSm Lig consistently everywhere

### Toolbar Overhaul
- Killed: "kolacik mixer" label, "play all" text, old boxy buttons
- Left zone: trash (SVG icon, 2-click confirm with 3s timeout), BPM (bare input), save, piece selector (shows current piece name)
- Center zone: three knob buttons protruding below toolbar — V (viz), ▶ (play, larger), M (mute all). Orange/red borders when active.
- Right zone: connection dot
- Removed add-track button (replaced by trash/clear)

### Track Panels
- Hover-to-reveal controls (vis, fx, group, M, S, × hidden at rest, fade in on hover)
- Track names: bigger (0.85rem), green when playing, red when muted, orange when soloed
- Code panels slightly transparent (0.85 opacity) so particles peek through
- Muted tracks dim to 0.35 opacity

### Keyboard Shortcuts
- `P` and MediaPlayPause: toggle play/pause
- `M`: toggle mute all
- `V`: toggle viz mode (existing)
- `0-9`: toggle mute for track groups (existing)

### Server Changes
- Piece loading now mutes all tracks by default (both HTTP and WebSocket handlers)
- Compiler regex fix: `$:` → `_$:` now uses `/gm` flag to match `$:` on any line, not just string start (was a pre-existing bug — tracks with comment headers couldn't be muted)

## Decisions

1. **Aesthetic from poems/voidchat** — near-black, grayscale, text controls, no decoration. Jura's consistent design language.
2. **Hover-to-reveal** over always-visible controls — cleaner at rest, functional on interaction.
3. **Knob buttons** for central controls — physical metaphor, visually distinct from text controls, protrude below toolbar.
4. **Mute all on piece load** — server-side, works for both browser and HTTP API. Safer for live use.
5. **Trash replaces add-track** — tracks come from pieces or Claude's HTTP API. Manual add was rarely used.
6. **Ref pattern for keyboard handler** — `muteAllRef` bridges the temporal dead zone between early `useEffect` and later `useCallback` definition.

## Bug Fixes

- **Compiler muting broken for tracks with comments** — `trackCode.replace(/^\$:/, '_$:')` only matched position 0. Fixed with `/gm` flag.
- **`handleMuteAll` TDZ crash** — `useCallback` isn't hoisted; `useEffect` at line 154 tried to capture it before definition. Fixed with ref indirection.

## Commits
- (pending)

## Files Changed
```
compiler.mjs                                  (regex fix: /gm flag)
sync-server.mjs                               (mute all on piece load)
website/src/pages/mixer.astro                  (body bg, CSS var overrides)
website/src/repl/Mixer.jsx                     (currentPiece, clearTracks, keyboard shortcuts, muteAllRef)
website/src/repl/Repl.css                      (mixer design system: vars, utility classes)
website/src/repl/components/MixerToolbar.jsx   (full rewrite: knobs, trash, new layout)
website/src/repl/components/TrackPanel.jsx     (hover-reveal, red/green names, code transparency)
```
