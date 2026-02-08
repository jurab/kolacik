# Kolacik Artifacts

Saved pieces for the kolacik mixer. Each artifact is a snapshot of all tracks + mixer state.

## Format

### Single-track (legacy, 01-04)
```
artifacts/<name>/
  pattern.strudel     # single strudel file for the REPL
```

### Multi-track (05+)
```
artifacts/<name>/
  tracks/             # one .strudel file per track
    kick.strudel
    bass.strudel
    ...
  mix.json            # mixer state (mute/solo/bpm/globalFx/groups)
```

## Save / Load

```bash
# Save current mixer state
./save-piece.sh my-piece-name

# Load a saved piece (replaces current tracks + mix.json)
./load-piece.sh 05-d-minor-multitrack

# List available pieces
ls artifacts/
```

The sync server watches `tracks/` and `mix.json` — changes are picked up automatically.

## Pieces

| # | Name | Key | Tracks | Notes |
|---|------|-----|--------|-------|
| 01 | clydes-first-drive | - | 1 | First playground experiment |
| 02 | techno-drop | - | 1 | Techno with stutter effect |
| 03 | stutter-crossfade | - | 1 | Crossfade technique |
| 04 | heartbeat-replica | - | 1 | Heartbeat pattern |
| 05 | d-minor-multitrack | D minor | 11 | First mixer piece: drums, bass, chords, pad, melody, arp. Mouse LPF via global FX. |
