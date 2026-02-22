import { useState, useRef, useEffect } from 'react';

export function MixerToolbar({ started, connected, bpm, vizMode, pieces, currentPiece, allMuted, onPlay, onStop, onBpmChange, onMuteAll, onClearTracks, onVizToggle, onSavePiece, onLoadPiece }) {
  const [trashArmed, setTrashArmed] = useState(false);
  const trashTimer = useRef(null);

  useEffect(() => {
    return () => { if (trashTimer.current) clearTimeout(trashTimer.current); };
  }, []);

  const handleTrash = () => {
    if (trashArmed) {
      clearTimeout(trashTimer.current);
      setTrashArmed(false);
      onClearTracks();
    } else {
      setTrashArmed(true);
      trashTimer.current = setTimeout(() => setTrashArmed(false), 3000);
    }
  };

  return (
    <div
      className="fixed top-0 left-0 right-0 z-10 flex items-center px-4"
      style={{
        background: 'var(--mixer-bg)',
        borderBottom: '1px solid var(--mixer-border)',
        padding: '6px 16px',
        fontFamily: 'var(--mixer-font)',
        height: 36,
      }}
    >
      {/* ── Left zone: trash, BPM, save, piece selector ── */}
      <div className="flex items-center gap-4">
        <button
          className="mixer-btn"
          onClick={handleTrash}
          title={trashArmed ? 'Click again to delete all tracks' : 'Clear all tracks'}
          style={{ color: trashArmed ? '#f44' : undefined, fontSize: '0.9rem', padding: '0 0.25rem' }}
        >
          {trashArmed
            ? <span style={{ fontSize: '0.75rem' }}>confirm?</span>
            : <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1.5 3.5h11M5 3.5V2a1 1 0 011-1h2a1 1 0 011 1v1.5M3 3.5l.5 8.5a1 1 0 001 1h5a1 1 0 001-1l.5-8.5M5.5 6v4M8.5 6v4" />
              </svg>
          }
        </button>

        <input
          type="number"
          className="mixer-bpm-input"
          value={bpm ?? ''}
          onChange={(e) => onBpmChange(e.target.value)}
          placeholder="---"
          title="BPM"
        />

        <span style={{ color: 'var(--mixer-border)', userSelect: 'none' }}>|</span>

        <button className="mixer-btn" onClick={onSavePiece} title="Save current session as piece">
          save
        </button>

        <select
          className="mixer-select"
          value=""
          onChange={(e) => {
            if (e.target.value) onLoadPiece(e.target.value);
            e.target.value = '';
          }}
          title="Load piece"
        >
          <option value="">{currentPiece || 'pieces'}</option>
          {(pieces || []).map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      {/* ── Center zone: knob controls (V, Play, M) ── */}
      <div className="flex items-center gap-3" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
        <button
          className="mixer-knob"
          onClick={onVizToggle}
          title="Toggle viz mode (V)"
          style={{ borderColor: vizMode ? 'var(--mixer-accent)' : undefined, color: vizMode ? 'var(--mixer-accent)' : undefined }}
        >
          V
        </button>

        <button
          className="mixer-knob mixer-knob-lg"
          onClick={started ? onStop : onPlay}
          title={started ? 'Stop (P)' : 'Play (P)'}
          style={{ borderColor: started ? 'var(--mixer-accent)' : undefined, color: started ? 'var(--mixer-accent)' : undefined }}
        >
          {started ? '\u25A0' : '\u25B6'}
        </button>

        <button
          className="mixer-knob"
          onClick={onMuteAll}
          title="Mute / unmute all (M)"
          style={{ borderColor: allMuted ? '#f44' : undefined, color: allMuted ? '#f44' : undefined }}
        >
          M
        </button>
      </div>

      {/* ── Right zone: connection status ── */}
      <div className="flex items-center" style={{ marginLeft: 'auto' }}>
        <div
          style={{
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: connected ? 'var(--mixer-status-ok)' : '#f44',
            flexShrink: 0,
          }}
          title={connected ? 'connected' : 'disconnected'}
        />
      </div>
    </div>
  );
}
