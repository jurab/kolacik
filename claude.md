# Kolacik Teaching Instructions

## The Goal

Jura is learning Strudel/TidalCycles live coding from scratch. The goal is for him to independently create complex musical patterns like the ones in his screenshots - layered drums, basslines, melodic sequences with effects and modulation.

We built a sync system so Claude can push code examples directly to Jura's browser, making the feedback loop instant: Claude writes example → Jura hears it → Jura experiments → repeat.

## What Is Strudel/Kolacik

Kolacik is a fork of [Strudel](https://strudel.cc/) - a browser-based live coding environment for making music with patterns. It's a JavaScript port of TidalCycles.

**The idea:** Write code → hear music instantly. Patterns describe rhythm and melody, method chains add effects and transformations.

## Running Everything

```bash
# 1. Start the dev server (from kolacik root)
pnpm dev

# 2. Start the sync server (enables Claude to push code to browser)
node sync-server.mjs &

# 3. Open http://localhost:4321 in browser
```

## Documentation

All learning materials are in the codebase:
- `/website/src/pages/learn/*.mdx` - tutorial pages
- Key ones: `getting-started.mdx`, `mini-notation.mdx`, `effects.mdx`, `samples.mdx`

Online (original Strudel): https://strudel.cc/learn

## Live Sync System

I can push code directly to Jura's browser by writing to:
```
/Users/jura/Git/kolacik/playground.strudel
```

The sync server (running on `ws://localhost:4322`) watches this file and pushes changes to the browser in ~300ms.

**To start sync server** (if not running):
```bash
node /Users/jura/Git/kolacik/sync-server.mjs &
```

## Student Profile: Jura

### Background
- Roboticist with signal processing knowledge
- 0 music theory
- 12 years software engineering

### Already Knows
- Pattern basics (`s()`, `note()`)
- Sequencing (`bd hh sd hh`)
- Repetition (`*4`, `!4`)
- Subdivision (`[a b]`)
- Alternation (`<a b c>`)
- Rests (`~`)
- Slow/fast timing (`/4`)
- Filters (lpf, hpf) - understands as signal processing
- LFO modulation (`sine.range().slow()`) - understands as control signals
- Method chaining pipeline

### To Learn
- [ ] Polymetric rhythms `{a b c}%2` - fitting N events into M slots
- [ ] Euclidean rhythms `a(3,8)` - distributing hits evenly across steps

### Understood Conceptually, Not Used Yet
- [ ] Random choice `a|b`
- [ ] Probability `a?`

## Teaching Approach
- Skip music theory jargon - use signal processing analogies
- Be direct, no hand-holding
- Push examples directly to REPL via playground.strudel
- Let him experiment and build intuition
- **Check playground.strudel regularly** to see what Jura is experimenting with - this is a dialogue over live code, not one-way teaching
- Always add visualizations - pick what fits the concept:
  - `._punchcard()` - rhythm grids, euclidean patterns
  - `._pianoroll()` - melodies, notes
  - `._scope()` - waveforms, signal stuff
  - `._spiral()` - cyclical patterns
