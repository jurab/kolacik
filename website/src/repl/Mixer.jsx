import { useCallback, useEffect, useRef, useState } from 'react';
import { silence } from '@strudel/core';
import { getDrawContext } from '@strudel/draw';
import { transpiler } from '@strudel/transpiler';
import {
  getAudioContextCurrentTime,
  webaudioOutput,
  initAudioOnFirstClick,
} from '@strudel/webaudio';
import { StrudelMirror, initEditor } from '@strudel/codemirror';
import { prebake } from './prebake.mjs';
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
// Track Editor — one CodeMirror per track
// ============================================================

function TrackPanel({ id, code, muted, solo, group, onCodeChange, onMute, onSolo, onRemove, onGroupChange }) {
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const codeRef = useRef(code);

  useEffect(() => {
    if (!containerRef.current || editorRef.current) return;

    const editor = initEditor({
      root: containerRef.current,
      initialCode: code,
      onChange: (v) => {
        if (v.docChanged) {
          const newCode = v.state.doc.toString();
          codeRef.current = newCode;
          onCodeChange(id, newCode);
        }
      },
    });
    editorRef.current = editor;
  }, []);

  // Sync external code changes (from file/WebSocket)
  useEffect(() => {
    if (editorRef.current && code !== codeRef.current) {
      codeRef.current = code;
      const editor = editorRef.current;
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: code },
      });
    }
  }, [code]);

  return (
    <div className={`border border-lineHighlight rounded-md overflow-hidden ${muted ? 'opacity-40' : ''}`}>
      <div className="flex items-center justify-between bg-lineHighlight px-3 py-1.5">
        <span className="text-foreground font-mono text-sm font-bold">{id}</span>
        <div className="flex gap-1 items-center">
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
        className="min-h-[60px] max-h-[200px] overflow-auto"
        style={{ fontSize: '14px', fontFamily: '"Operator Mono SSm Lig", monospace' }}
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
  const [mixState, setMixState] = useState({ muted: [], solo: [], bpm: null, globalFx: '', groups: {} });
  const [started, setStarted] = useState(false);
  const [connected, setConnected] = useState(false);
  const masterRef = useRef(null);
  const masterContainerRef = useRef(null);
  const playOnceTimerRef = useRef(null);
  const debounceTimers = useRef({});

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
    } else if (msg.type === 'play-once') {
      playOnce();
    }
  }, []);

  // Setup sync + master on mount
  useEffect(() => {
    initMaster();
    initMixerSync(handleSyncMessage);
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
  const mixStateRef = useRef(mixState);
  mixStateRef.current = mixState;
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;

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
    if (playOnceTimerRef.current) {
      clearTimeout(playOnceTimerRef.current);
      playOnceTimerRef.current = null;
    }
  }, []);

  const playOnce = useCallback(() => {
    if (!masterRef.current) return;
    masterRef.current.evaluate();
    const cps = masterRef.current.repl.scheduler.cps || 0.5;
    const cycleDurationMs = (1 / cps) * 1000;
    if (playOnceTimerRef.current) clearTimeout(playOnceTimerRef.current);
    playOnceTimerRef.current = setTimeout(() => {
      masterRef.current?.stop();
      playOnceTimerRef.current = null;
    }, cycleDurationMs + 150);
  }, []);

  const sortedTrackIds = Object.keys(tracks).sort();

  return (
    <div className="h-app-height bg-background flex flex-col text-foreground">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-lineHighlight border-b border-lineHighlight shrink-0">
        <span className="font-mono text-sm font-bold mr-2">kolacik mixer</span>

        <button
          onClick={started ? handleStop : handlePlayAll}
          className={`px-3 py-1 rounded text-sm font-mono cursor-pointer ${
            started ? 'bg-green-700 text-white animate-pulse' : 'bg-background text-foreground hover:bg-green-700'
          }`}
        >
          {started ? '■ stop' : '▶ play all'}
        </button>

        <button
          onClick={playOnce}
          className="px-3 py-1 rounded text-sm font-mono bg-background text-foreground hover:bg-blue-700 cursor-pointer"
        >
          ▶1
        </button>

        <div className="flex items-center gap-1 ml-4">
          <label className="text-xs font-mono text-foreground opacity-60">BPM</label>
          <input
            type="number"
            value={mixState.bpm ?? ''}
            onChange={(e) => handleBpmChange(e.target.value)}
            placeholder="auto"
            className="w-16 px-1 py-0.5 rounded text-sm font-mono bg-background text-foreground border border-lineHighlight"
          />
        </div>

        <button
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
          onClick={handleAddTrack}
          className="px-3 py-1 rounded text-sm font-mono bg-background text-foreground hover:bg-green-700 cursor-pointer ml-auto"
        >
          + track
        </button>

        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} title={connected ? 'connected' : 'disconnected'} />
      </div>

      {/* Track panels */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
        {sortedTrackIds.map((id) => (
          <TrackPanel
            key={id}
            id={id}
            code={tracks[id]}
            muted={mixState.muted?.includes(id) || false}
            solo={mixState.solo?.includes(id) || false}
            group={mixState.groups?.[id] ?? null}
            onCodeChange={handleTrackCodeChange}
            onMute={handleMute}
            onSolo={handleSolo}
            onRemove={handleRemove}
            onGroupChange={handleGroupChange}
          />
        ))}

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
