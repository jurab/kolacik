import { useCallback, useEffect, useRef, useState } from 'react';
import { silence } from '@strudel/core';
import { getDrawContext } from '@strudel/draw';
import { transpiler } from '@strudel/transpiler';
import {
  getAudioContextCurrentTime,
  webaudioOutput,
  initAudioOnFirstClick,
} from '@strudel/webaudio';
import { StrudelMirror } from '@strudel/codemirror';
import { prebake } from './prebake.mjs';
import { loadModules } from './util.mjs';
import { CurlParticles } from './effects/CurlParticles.mjs';
import { detectEffects, createDetectorState } from './effects/effectDetector.mjs';
import { TrackPanel } from './components/TrackPanel.jsx';
import { MixerToolbar } from './components/MixerToolbar.jsx';
import {
  initMixerSync,
  sendTrackCode,
  sendRemoveTrack,
  sendMixerState,
  sendSavePiece,
  sendLoadPiece,
  sendDeletePiece,
} from './mixer-sync.mjs';
import { setInterval, clearInterval } from 'worker-timers';

let modulesLoading, presets, audioReady;

if (typeof window !== 'undefined') {
  audioReady = initAudioOnFirstClick();
  modulesLoading = loadModules();
  presets = prebake();
}

// ============================================================
// Main Mixer Component
// ============================================================

export function Mixer() {
  const [tracks, setTracks] = useState({});
  const [mixState, setMixState] = useState({ muted: [], solo: [], bpm: null, globalFx: '', groups: {}, trackFx: {} });
  const [pieces, setPieces] = useState([]);
  const [vizTypes, setVizTypes] = useState({});
  const [started, setStarted] = useState(false);
  const [connected, setConnected] = useState(false);
  const [vizMode, setVizMode] = useState(false);
  const [currentPiece, setCurrentPiece] = useState(null);
  const masterRef = useRef(null);
  const masterContainerRef = useRef(null);
  const curlRef = useRef(null);
  const fxStateRef = useRef(createDetectorState());
  const debounceTimers = useRef({});
  const mixStateRef = useRef(mixState);
  mixStateRef.current = mixState;
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const muteAllRef = useRef(null);
  const preMuteRef = useRef(null);

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
      const state = msg.state || { muted: [], solo: [], bpm: null, globalFx: '', groups: {} };
      setMixState(state);
      setCurrentPiece(state.currentPiece || null);
      setPieces(msg.pieces || []);
      setConnected(true);
      if (msg.compiled && masterRef.current) {
        masterRef.current.setCode(msg.compiled);
      }
    } else if (msg.type === 'pieces:list') {
      setPieces(msg.pieces || []);
    } else if (msg.type === 'mixer:compiled') {
      if (masterRef.current) {
        masterRef.current.setCode(msg.code);
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
      if ('currentPiece' in msg.state) setCurrentPiece(msg.state.currentPiece || null);
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

    const master = masterRef.current;
    if (master) {
      const origDraw = master.onDraw.bind(master);
      master.onDraw = (haps, time, painters) => {
        origDraw(haps, time, painters);
        if (curlRef.current) {
          detectEffects(haps, time, mixStateRef.current?.trackFx, fxStateRef.current, curlRef.current.effects);
        }
      };
    }

    return () => {
      curlRef.current?.destroy();
      curlRef.current = null;
    };
  }, []);

  // Viz mode sync
  useEffect(() => {
    curlRef.current?.setForeground(vizMode);
  }, [vizMode]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'MediaPlayPause') {
        e.preventDefault();
        if (masterRef.current?.repl?.scheduler?.started) masterRef.current.stop();
        else masterRef.current?.evaluate();
        return;
      }
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.closest('.cm-editor')) return;
      if (e.code === 'KeyV') setVizMode(v => !v);
      if (e.code === 'KeyP') {
        if (masterRef.current?.repl?.scheduler?.started) masterRef.current.stop();
        else masterRef.current?.evaluate();
      }
      if (e.code === 'KeyM') muteAllRef.current?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Track code change
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

  // Clear all tracks
  const handleClearTracks = useCallback(() => {
    const ids = Object.keys(tracksRef.current);
    for (const id of ids) sendRemoveTrack(id);
    setTracks({});
    setCurrentPiece(null);
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

  // Track FX assignment
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

  // Piece management
  const handleSavePiece = useCallback((name) => {
    if (name?.trim()) {
      sendSavePiece(name.trim());
      setCurrentPiece(name.trim());
      setMixState(prev => {
        const next = { ...prev, currentPiece: name.trim() };
        sendMixerState(next);
        return next;
      });
    }
  }, []);

  const handleLoadPiece = useCallback((name) => {
    sendLoadPiece(name);
    setCurrentPiece(name);
  }, []);

  const handleDeletePiece = useCallback((name) => {
    if (confirm(`Delete piece "${name}"?`)) sendDeletePiece(name);
  }, []);


  // Mute all toggle — independent from per-track muting
  // Snapshots per-track mute state before engaging, restores on disengage
  const handleMuteAll = useCallback(() => {
    setMixState(prev => {
      const allIds = Object.keys(tracksRef.current);
      const allMuted = allIds.length > 0 && allIds.every(id => prev.muted.includes(id));
      let next;
      if (allMuted) {
        // Disengage: restore previous per-track mute state
        next = { ...prev, muted: preMuteRef.current || [] };
        preMuteRef.current = null;
      } else {
        // Engage: snapshot current mutes, then mute all
        preMuteRef.current = [...prev.muted];
        next = { ...prev, muted: [...allIds] };
      }
      sendMixerState(next);
      return next;
    });
  }, []);
  muteAllRef.current = handleMuteAll;

  // Keyboard: number keys toggle mute for track groups
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.closest('.cm-editor, input, select, textarea')) return;

      const key = e.key;
      if (key >= '0' && key <= '9') {
        const group = Number(key);
        const state = mixStateRef.current;
        const groups = state.groups || {};
        const trackIds = Object.keys(tracksRef.current).filter(id => groups[id] === group);
        if (trackIds.length === 0) return;

        const anyUnmuted = trackIds.some(id => !state.muted.includes(id));
        let muted;
        if (anyUnmuted) {
          muted = [...new Set([...state.muted, ...trackIds])];
        } else {
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
    masterRef.current?.evaluate();
  }, []);

  const handleStop = useCallback(() => {
    masterRef.current?.stop();
  }, []);

  const sortedTrackIds = Object.keys(tracks).sort();

  return (
    <div style={{ background: 'transparent', position: 'relative', zIndex: 2, color: 'var(--mixer-text)' }}>
      <MixerToolbar
        started={started}
        connected={connected}
        bpm={mixState.bpm}
        vizMode={vizMode}
        pieces={pieces}
        currentPiece={currentPiece}
        allMuted={sortedTrackIds.length > 0 && sortedTrackIds.every(id => mixState.muted?.includes(id))}
        onPlay={handlePlayAll}
        onStop={handleStop}
        onBpmChange={handleBpmChange}
        onMuteAll={handleMuteAll}
        onClearTracks={handleClearTracks}
        onVizToggle={() => setVizMode(v => !v)}
        onSavePiece={handleSavePiece}
        onLoadPiece={handleLoadPiece}
      />

      <div className="px-4 py-2 flex flex-col gap-2" style={{ marginTop: '2.5rem', pointerEvents: vizMode ? 'none' : 'auto' }}>
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
            modulesLoading={modulesLoading}
            presets={presets}
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
          <div className="text-center text-sm py-8" style={{ color: 'var(--mixer-text-subtle)', fontFamily: 'var(--mixer-font)' }}>
            no tracks
          </div>
        )}
      </div>

      {/* Hidden master repl — handles all audio */}
      <div ref={masterContainerRef} className="overflow-hidden h-0" />
    </div>
  );
}
