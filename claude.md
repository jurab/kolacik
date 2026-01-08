# Kolacik Teaching Instructions

## The Goal

Jura is learning Strudel/TidalCycles live coding from scratch. The goal is for him to independently create complex musical patterns like the ones in his screenshots - layered drums, basslines, melodic sequences with effects and modulation.

We built a sync system so Claude can push code examples directly to Jura's browser, making the feedback loop instant: Claude writes example → Jura hears it → Jura experiments → repeat.

## What Is Strudel/Kolacik

Kolacik is a fork of [Strudel](https://strudel.cc/) - a browser-based live coding environment for making music with patterns. It's a JavaScript port of TidalCycles.

**The idea:** Write code → hear music instantly. Patterns describe rhythm and melody, method chains add effects and transformations.

## Running Everything

**At session start, Claude should start both servers:**

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

## Error Feedback

Warnings and errors sync back to me via:
```
/Users/jura/Git/kolacik/playground.errors
```

**Check this file after pushing code** to see if something silently failed. Jura also sees a toast notification in the UI.

## Common Gotchas

Things that fail silently in Strudel - watch out for these:

- **`.add(12)` doesn't work** - must wrap in `note()`: `.add(note(12))`
- **Can't mix samples and notes** - `note("c3, hh")` breaks because `hh` isn't a pitch. Use `stack()` or separate `$:` lines
- **Out-of-range notes** - `note("c90")` produces silence (TODO: add warning)
- **Core package changes need hard refresh** - HMR doesn't always pick them up

## Student Profile: Jura

### Background
- Roboticist with signal processing knowledge
- 0 music theory
- 12 years software engineering

### Already Knows
See `what_jura_knows.md` for detailed state. Highlights:
- All pattern basics (sequencing, subdivision, alternation, rests)
- Euclidean rhythms, polymetric, struct, mask, iter, every
- Effects: off, jux, delay, echo, filters
- Notes: letter notation, scale indices, add (with note wrapper), arp
- Layering: stack, multiple $: lines

### To Learn
- [ ] Chords - what they are, how to construct them
- [ ] More effects beyond filter/delay
- [ ] Control patterns in depth

### Understood Conceptually, Not Used Yet
- Random choice `a|b`, probability `a?`
- LFO modulation `sine.range().slow()`
- `.chop()` for sample slicing

## Teaching Approach
- Teach music theory as needed - Jura wants to learn it, just starts from zero. Use signal processing analogies where helpful.
- Be direct, no hand-holding
- Push examples directly to REPL via playground.strudel
- Let him experiment and build intuition
- **Check playground.strudel regularly** to see what Jura is experimenting with - this is a dialogue over live code, not one-way teaching
- Always add visualizations - pick what fits the concept:
  - `._punchcard()` - rhythm grids, euclidean patterns
  - `._pianoroll()` - melodies, notes
  - `._scope()` - waveforms, signal stuff
  - `._spiral()` - cyclical patterns
