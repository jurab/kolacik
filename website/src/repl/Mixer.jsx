import { useCallback, useEffect, useRef, useState } from 'react';
import { silence } from '@strudel/core';
import { getDrawContext, getPunchcardPainter } from '@strudel/draw';
import { transpiler } from '@strudel/transpiler';
import {
  getAudioContextCurrentTime,
  webaudioOutput,
  initAudioOnFirstClick,
} from '@strudel/webaudio';
import { StrudelMirror, initEditor } from '@strudel/codemirror';
import { prebake } from './prebake.mjs';
import { CurlParticles } from './CurlParticles.mjs';
import { loadModules } from './util.mjs';
import {
  initMixerSync,
  sendTrackCode,
  sendAddTrack,
  sendRemoveTrack,
  sendMixerState,
} from './mixer-sync.mjs';
import { setInterval, clearInterval } from 'worker-timers';

let modulesLoading, presets, audioReady;

if (typeof window !== 'undefined') {
  audioReady = initAudioOnFirstClick();
  modulesLoading = loadModules();
  presets = prebake();
}

// ============================================================
// Track Editor — StrudelMirror per track (vis + highlighting)
// ============================================================

function TrackPanel({ id, code, muted, solo, group, effectivelyMuted, fx, viz, started, vizMode, onCodeChange, onMute, onSolo, onRemove, onGroupChange, onVizChange, onFxChange }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const mirrorRef = useRef(null);
  const codeRef = useRef(code);
  const vizRef = useRef(viz);
  const startedRef = useRef(started);
  const externalRef = useRef(false);
  const evalTimerRef = useRef(null);
  const onCodeChangeRef = useRef(onCodeChange);
  onCodeChangeRef.current = onCodeChange;
  vizRef.current = viz;
  startedRef.current = started;

  // Initialize StrudelMirror + canvas
  useEffect(() => {
    if (!containerRef.current || mirrorRef.current) return;

    // Create per-track canvas for visualization (behind editor)
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0';
    containerRef.current.style.position = 'relative';
    containerRef.current.appendChild(canvas);
    canvasRef.current = canvas;

    // Size canvas
    const rect = containerRef.current.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    const drawTime = [-2, 2];

    const mirror = new StrudelMirror({
      root: containerRef.current,
      initialCode: code,
      defaultOutput: async () => {}, // silent — master handles audio
      getTime: getAudioContextCurrentTime,
      setInterval,
      clearInterval,
      transpiler,
      autodraw: false,
      pattern: silence,
      drawTime,
      drawContext: ctx,
      prebake: async () => Promise.all([modulesLoading, presets]),
      onUpdateState: () => {},
      bgFill: false,
      solo: false,
      editPattern: (pat) => {
        const v = vizRef.current;
        if (v === 'punchcard') return pat.punchcard();
        if (v === 'pianoroll') return pat.onPaint(getPunchcardPainter({ fold: 0 }));
        if (v === 'wordfall') return pat.onPaint(getPunchcardPainter({ vertical: 1, labels: 1, stroke: 0, fillActive: 1, active: 'white' }));
        if (v === 'smear') return pat.onPaint(getPunchcardPainter({ fold: 0, smear: 1 }));
        if (v === 'active') return pat.onPaint(getPunchcardPainter({ fold: 0, hideInactive: 1, fillActive: 1 }));
        return pat;
      },
      onToggle: (on) => {
        // Clear per-track canvas when repl stops
        if (!on && canvasRef.current) {
          const c = canvasRef.current.getContext('2d');
          c.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
      },
    });
    mirrorRef.current = mirror;

    // Override StrudelMirror's default font size
    mirror.setFontSize(14);

    // Ensure editor sits above canvas and respects container height
    const cmEditor = containerRef.current.querySelector('.cm-editor');
    if (cmEditor) {
      cmEditor.style.position = 'relative';
      cmEditor.style.zIndex = '1';
      cmEditor.style.maxHeight = '100%';
    }
    const cmScroller = containerRef.current.querySelector('.cm-scroller');
    if (cmScroller) {
      cmScroller.style.maxHeight = '200px';
      cmScroller.style.overflow = 'auto';
    }

    // Intercept code changes via property override on mirror.code
    let _mirrorCode = mirror.code;
    Object.defineProperty(mirror, 'code', {
      get() { return _mirrorCode; },
      set(val) {
        _mirrorCode = val;
        codeRef.current = val;
        if (!externalRef.current) {
          onCodeChangeRef.current(id, val);
        }
        // Debounced re-evaluate for visualization/highlighting
        if (evalTimerRef.current) clearTimeout(evalTimerRef.current);
        evalTimerRef.current = setTimeout(() => {
          if (mirrorRef.current) {
            mirrorRef.current.repl.evaluate(mirrorRef.current.code, startedRef.current);
          }
        }, 500);
      },
    });

    // ResizeObserver for canvas sizing
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      const d = window.devicePixelRatio || 1;
      canvas.width = width * d;
      canvas.height = height * d;
    });
    ro.observe(containerRef.current);

    return () => {
      if (evalTimerRef.current) clearTimeout(evalTimerRef.current);
      ro.disconnect();
      mirror.stop();
      mirror.clear();
    };
  }, []);

  // Sync external code changes (from file/WebSocket)
  useEffect(() => {
    if (mirrorRef.current && code !== codeRef.current) {
      codeRef.current = code;
      externalRef.current = true;
      mirrorRef.current.setCode(code);
      externalRef.current = false;
      // Re-eval is scheduled by the code setter automatically
    }
  }, [code]);

  // Start/stop per-track repl in sync with master
  useEffect(() => {
    if (!mirrorRef.current) return;
    if (started) {
      mirrorRef.current.repl.evaluate(mirrorRef.current.code, true);
    } else {
      mirrorRef.current.stop();
    }
  }, [started]);

  // Re-evaluate when viz type changes (to inject/remove painter)
  useEffect(() => {
    if (!mirrorRef.current) return;
    // Clear canvas when switching viz
    if (canvasRef.current) {
      const c = canvasRef.current.getContext('2d');
      c.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    mirrorRef.current.repl.evaluate(mirrorRef.current.code, startedRef.current);
  }, [viz]);

  return (
    <div className={`border border-lineHighlight rounded-md overflow-hidden transition-opacity duration-500 ${effectivelyMuted && !vizMode ? 'opacity-40' : ''}`} style={{ backgroundColor: 'rgba(26, 26, 26, 0.85)', opacity: vizMode ? 0.5 : undefined }}>
      <div className="flex items-center justify-between px-3 py-1.5" style={{ backgroundColor: 'rgba(40, 40, 40, 0.9)' }}>
        <span className={`font-mono text-sm font-bold ${effectivelyMuted ? 'text-red-500' : 'text-green-500'}`}>
          {group != null ? `${group}: ` : ''}{id}
        </span>
        <div className="flex gap-1 items-center transition-opacity duration-500" style={{ opacity: vizMode ? 0 : 1, pointerEvents: vizMode ? 'none' : 'auto' }}>
          <select
            value={viz || ''}
            onChange={(e) => onVizChange(id, e.target.value || null)}
            className="w-16 px-0.5 py-0.5 rounded text-xs font-mono bg-background text-foreground border border-lineHighlight cursor-pointer text-center appearance-none"
            title="Visualization"
          >
            <option value="">vis</option>
            <option value="pianoroll">piano</option>
            <option value="punchcard">punch</option>
            <option value="wordfall">fall</option>
            <option value="smear">smear</option>
            <option value="active">active</option>
          </select>
          <select
            value={fx || ''}
            onChange={(e) => onFxChange(id, e.target.value || null)}
            className="w-16 px-0.5 py-0.5 rounded text-xs font-mono bg-background text-foreground border border-lineHighlight cursor-pointer text-center appearance-none"
            title="Particle effect"
          >
            <option value="">auto</option>
            <option value="none">none</option>
            <option value="burst">burst</option>
            <option value="swell">swell</option>
            <option value="orbitPulse">orbit</option>
            <option value="jitter">jitter</option>
            <option value="tangent">tangent</option>
            <option value="flash">flash</option>
            <option value="pad">pad</option>
          </select>
          <select
            value={group ?? ''}
            onChange={(e) => onGroupChange(id, e.target.value === '' ? null : Number(e.target.value))}
            className="w-10 px-0.5 py-0.5 rounded text-xs font-mono bg-background text-foreground border border-lineHighlight cursor-pointer text-center appearance-none"
            title="Group (press number key to toggle mute)"
          >
            <option value="">-</option>
            {[0,1,2,3,4,5,6,7,8,9].map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <button
            onClick={() => onMute(id)}
            className={`px-2 py-0.5 rounded text-xs font-mono cursor-pointer ${
              muted ? 'bg-red-700 text-white' : 'bg-background text-foreground hover:bg-red-700'
            }`}
          >
            M
          </button>
          <button
            onClick={() => onSolo(id)}
            className={`px-2 py-0.5 rounded text-xs font-mono cursor-pointer ${
              solo ? 'bg-yellow-600 text-white' : 'bg-background text-foreground hover:bg-yellow-600'
            }`}
          >
            S
          </button>
          <button
            onClick={() => onRemove(id)}
            className="px-2 py-0.5 rounded text-xs font-mono bg-background text-foreground hover:bg-red-900 cursor-pointer"
          >
            X
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="min-h-[60px] transition-opacity duration-500"
        style={{ fontFamily: '"Operator Mono SSm Lig", monospace', opacity: vizMode ? 0.5 : 1 }}
      />
    </div>
  );
}

// ============================================================
// Global FX Editor
// ============================================================

function GlobalFxEditor({ code, onChange }) {
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const codeRef = useRef(code);

  useEffect(() => {
    if (!containerRef.current || editorRef.current) return;

    const editor = initEditor({
      root: containerRef.current,
      initialCode: code || '',
      onChange: (v) => {
        if (v.docChanged) {
          const newCode = v.state.doc.toString();
          codeRef.current = newCode;
          onChange(newCode);
        }
      },
    });
    editorRef.current = editor;
  }, []);

  useEffect(() => {
    if (editorRef.current && code !== codeRef.current) {
      codeRef.current = code;
      const editor = editorRef.current;
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: code || '' },
      });
    }
  }, [code]);

  return (
    <div className="border border-lineHighlight rounded-md overflow-hidden">
      <div className="bg-lineHighlight px-3 py-1.5">
        <span className="text-foreground font-mono text-sm font-bold">global fx</span>
      </div>
      <div
        ref={containerRef}
        className="min-h-[40px] max-h-[120px] overflow-auto"
        style={{ fontSize: '14px', fontFamily: '"Operator Mono SSm Lig", monospace' }}
      />
    </div>
  );
}

// ============================================================
// Main Mixer Component
// ============================================================

export function Mixer() {
  const [tracks, setTracks] = useState({});      // { id: code }
  const [mixState, setMixState] = useState({ muted: [], solo: [], bpm: null, globalFx: '', groups: {}, trackFx: {} });
  const [vizTypes, setVizTypes] = useState({});  // { trackId: 'pianoroll' | 'punchcard' | null }
  const [started, setStarted] = useState(false);
  const [connected, setConnected] = useState(false);
  const [vizMode, setVizMode] = useState(false); // false=edit, true=viz fullscreen
  const masterRef = useRef(null);
  const masterContainerRef = useRef(null);
  const curlRef = useRef(null);
  const debounceTimers = useRef({});
  const mixStateRef = useRef(mixState);
  mixStateRef.current = mixState;
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;

  // Init master StrudelMirror (hidden, handles all audio)
  const initMaster = useCallback(() => {
    if (masterRef.current) return;

    const drawContext = getDrawContext();
    const master = new StrudelMirror({
      defaultOutput: webaudioOutput,
      getTime: getAudioContextCurrentTime,
      setInterval,
      clearInterval,
      transpiler,
      autodraw: false,
      root: masterContainerRef.current,
      initialCode: '// mixer master',
      pattern: silence,
      drawTime: [-2, 2],
      drawContext,
      prebake: async () => Promise.all([modulesLoading, presets]),
      onUpdateState: (state) => {
        setStarted(state.started);
      },
      beforeEval: () => audioReady,
      bgFill: false,
      solo: false,
    });
    masterRef.current = master;
    window.mixerMaster = master;
  }, []);

  // Handle messages from sync server
  const handleSyncMessage = useCallback((msg) => {
    if (msg.type === 'mixer:init') {
      setTracks(msg.tracks || {});
      setMixState(msg.state || { muted: [], solo: [], bpm: null, globalFx: '', groups: {} });
      setConnected(true);
      // Evaluate compiled code if we have it
      if (msg.compiled && masterRef.current) {
        masterRef.current.setCode(msg.compiled);
      }
    } else if (msg.type === 'mixer:compiled') {
      if (masterRef.current) {
        masterRef.current.setCode(msg.code);
        // Auto-evaluate if already playing
        if (masterRef.current.repl.scheduler.started) {
          masterRef.current.evaluate();
        }
      }
    } else if (msg.type === 'mixer:track') {
      setTracks(prev => ({ ...prev, [msg.id]: msg.code }));
    } else if (msg.type === 'mixer:track:removed') {
      setTracks(prev => {
        const next = { ...prev };
        delete next[msg.id];
        return next;
      });
    } else if (msg.type === 'mixer:state') {
      setMixState(msg.state);
    } else if (msg.type === 'play') {
      masterRef.current?.evaluate();
    } else if (msg.type === 'stop') {
      masterRef.current?.stop();
    } else if (msg.type === 'toggle') {
      masterRef.current?.toggle();
    }
  }, []);

  // Setup sync + master + particles on mount
  useEffect(() => {
    initMaster();
    initMixerSync(handleSyncMessage);
    curlRef.current = new CurlParticles();

    // Wire master Drawer → particle system
    const master = masterRef.current;
    if (master) {
      const origDraw = master.onDraw.bind(master);
      master.onDraw = (haps, time, painters) => {
        origDraw(haps, time, painters);
        curlRef.current?.update(haps, time, mixStateRef.current?.trackFx);
      };
    }

    return () => {
      curlRef.current?.destroy();
      curlRef.current = null;
    };
  }, []);

  // Sync viz mode to particle system + keyboard shortcut
  useEffect(() => {
    curlRef.current?.setForeground(vizMode);
  }, [vizMode]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.closest('.cm-editor')) return;
      if (e.code === 'KeyV') setVizMode(v => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Track code change — debounced to avoid hammering the server
  const handleTrackCodeChange = useCallback((id, code) => {
    setTracks(prev => ({ ...prev, [id]: code }));
    if (debounceTimers.current[id]) clearTimeout(debounceTimers.current[id]);
    debounceTimers.current[id] = setTimeout(() => {
      sendTrackCode(id, code);
    }, 400);
  }, []);

  // Mute toggle
  const handleMute = useCallback((id) => {
    setMixState(prev => {
      const muted = prev.muted.includes(id)
        ? prev.muted.filter(x => x !== id)
        : [...prev.muted, id];
      const next = { ...prev, muted };
      sendMixerState(next);
      return next;
    });
  }, []);

  // Solo toggle
  const handleSolo = useCallback((id) => {
    setMixState(prev => {
      const solo = prev.solo.includes(id)
        ? prev.solo.filter(x => x !== id)
        : [...prev.solo, id];
      const next = { ...prev, solo };
      sendMixerState(next);
      return next;
    });
  }, []);

  // Remove track
  const handleRemove = useCallback((id) => {
    sendRemoveTrack(id);
    setTracks(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  // Add track
  const handleAddTrack = useCallback(() => {
    const existing = Object.keys(tracks);
    let name = 'track-' + (existing.length + 1);
    // Avoid collision
    while (tracks[name]) name += '-2';
    const code = `$: s("bd")\n`;
    sendAddTrack(name, code);
    setTracks(prev => ({ ...prev, [name]: code }));
  }, [tracks]);

  // Global FX change
  const handleGlobalFxChange = useCallback((code) => {
    setMixState(prev => {
      const next = { ...prev, globalFx: code };
      if (debounceTimers.current.__globalFx) clearTimeout(debounceTimers.current.__globalFx);
      debounceTimers.current.__globalFx = setTimeout(() => {
        sendMixerState(next);
      }, 400);
      return next;
    });
  }, []);

  // BPM change
  const handleBpmChange = useCallback((val) => {
    const bpm = val === '' ? null : Number(val);
    setMixState(prev => {
      const next = { ...prev, bpm };
      sendMixerState(next);
      return next;
    });
  }, []);

  // Viz type change (per-track)
  const handleVizChange = useCallback((id, vizType) => {
    setVizTypes(prev => ({ ...prev, [id]: vizType }));
  }, []);

  // Track FX assignment (per-track particle effect)
  const handleFxChange = useCallback((id, fx) => {
    setMixState(prev => {
      const trackFx = { ...prev.trackFx };
      if (fx === null) {
        delete trackFx[id];
      } else {
        trackFx[id] = fx;
      }
      const next = { ...prev, trackFx };
      sendMixerState(next);
      return next;
    });
  }, []);

  // Group assignment
  const handleGroupChange = useCallback((id, group) => {
    setMixState(prev => {
      const groups = { ...prev.groups };
      if (group === null) {
        delete groups[id];
      } else {
        groups[id] = group;
      }
      const next = { ...prev, groups };
      sendMixerState(next);
      return next;
    });
  }, []);

  // Keyboard: number keys toggle mute for track groups
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't fire when typing in an input/editor
      if (e.target.closest('.cm-editor, input, select, textarea')) return;

      const key = e.key;
      if (key >= '0' && key <= '9') {
        const group = Number(key);
        const state = mixStateRef.current;
        const groups = state.groups || {};
        // Find all tracks in this group
        const trackIds = Object.keys(tracksRef.current).filter(id => groups[id] === group);
        if (trackIds.length === 0) return;

        // Toggle: if any are unmuted, mute all; if all muted, unmute all
        const anyUnmuted = trackIds.some(id => !state.muted.includes(id));
        let muted;
        if (anyUnmuted) {
          // Mute all in group
          muted = [...new Set([...state.muted, ...trackIds])];
        } else {
          // Unmute all in group
          muted = state.muted.filter(id => !trackIds.includes(id));
        }
        const next = { ...state, muted };
        setMixState(next);
        sendMixerState(next);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Transport
  const handlePlayAll = useCallback(() => {
    if (masterRef.current) {
      masterRef.current.evaluate();
    }
  }, []);

  const handleStop = useCallback(() => {
    if (masterRef.current) {
      masterRef.current.stop();
    }
  }, []);

  const sortedTrackIds = Object.keys(tracks).sort();

  return (
    <div className="text-foreground" style={{ background: 'transparent', position: 'relative', zIndex: 2 }}>
      {/* Top bar */}
      <div id="mixer-toolbar" className="fixed top-0 left-0 right-0 z-10 flex items-center gap-2 px-4 py-2 border-b border-lineHighlight" style={{ backgroundColor: '#1a1a1a' }}>
        <span className="font-mono text-sm font-bold mr-2">kolacik mixer</span>

        <button
          id="btn-play"
          onClick={started ? handleStop : handlePlayAll}
          className={`w-24 py-1 rounded text-sm font-mono cursor-pointer text-center ${
            started ? 'bg-green-700 text-white animate-pulse' : 'bg-background text-foreground hover:bg-green-700'
          }`}
        >
          {started ? '■ stop' : '▶ play all'}
        </button>

        <div id="bpm-control" className="flex items-center gap-1 ml-4">
          <label className="text-xs font-mono text-foreground opacity-60">BPM</label>
          <input
            id="bpm-input"
            type="number"
            value={mixState.bpm ?? ''}
            onChange={(e) => handleBpmChange(e.target.value)}
            placeholder="auto"
            className="w-16 px-1 py-0.5 rounded text-sm font-mono bg-background text-foreground border border-lineHighlight"
          />
        </div>

        <button
          id="btn-mute-all"
          onClick={() => {
            setMixState(prev => {
              const allIds = Object.keys(tracks);
              const allMuted = allIds.every(id => prev.muted.includes(id));
              const next = { ...prev, muted: allMuted ? [] : [...allIds] };
              sendMixerState(next);
              return next;
            });
          }}
          className="px-3 py-1 rounded text-sm font-mono bg-background text-foreground hover:bg-red-700 cursor-pointer"
        >
          mute all
        </button>

        <button
          id="btn-add-track"
          onClick={handleAddTrack}
          className="px-3 py-1 rounded text-sm font-mono bg-background text-foreground hover:bg-green-700 cursor-pointer ml-auto"
        >
          + track
        </button>

        <button
          onClick={() => setVizMode(v => !v)}
          className={`px-3 py-1 rounded text-sm font-mono cursor-pointer ${
            vizMode ? 'bg-purple-700 text-white' : 'bg-background text-foreground hover:bg-purple-700'
          }`}
          title="Toggle viz mode (V)"
        >
          {vizMode ? '◉ viz' : '○ viz'}
        </button>

        <div id="sync-status" className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} title={connected ? 'connected' : 'disconnected'} />
      </div>

      {/* Track panels */}
      <div className="p-4 flex flex-col gap-3" style={{ marginTop: '3rem', pointerEvents: vizMode ? 'none' : 'auto' }}>
        {sortedTrackIds.map((id) => {
          const isMuted = mixState.muted?.includes(id) || false;
          const isSoloed = mixState.solo?.includes(id) || false;
          const hasSolo = (mixState.solo?.length || 0) > 0;
          const effectivelyMuted = isMuted || (hasSolo && !isSoloed);
          return <TrackPanel
            key={id}
            id={id}
            code={tracks[id]}
            muted={isMuted}
            solo={isSoloed}
            effectivelyMuted={effectivelyMuted}
            group={mixState.groups?.[id] ?? null}
            fx={mixState.trackFx?.[id] || null}
            viz={vizTypes[id] || null}
            started={started}
            vizMode={vizMode}
            onCodeChange={handleTrackCodeChange}
            onMute={handleMute}
            onSolo={handleSolo}
            onRemove={handleRemove}
            onGroupChange={handleGroupChange}
            onFxChange={handleFxChange}
            onVizChange={handleVizChange}
          />;
        })}

        {sortedTrackIds.length === 0 && (
          <div className="text-center text-foreground opacity-40 font-mono py-8">
            no tracks — click "+ track" or write to tracks/*.strudel
          </div>
        )}

        {/* Global FX */}
        <GlobalFxEditor code={mixState.globalFx || ''} onChange={handleGlobalFxChange} />
      </div>

      {/* Hidden master repl — handles all audio */}
      <div ref={masterContainerRef} className="overflow-hidden h-0" />
    </div>
  );
}
