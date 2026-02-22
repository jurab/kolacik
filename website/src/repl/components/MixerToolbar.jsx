import { useState, useRef, useEffect } from 'react';

export function MixerToolbar({ started, connected, bpm, vizMode, pieces, currentPiece, allMuted, onPlay, onStop, onBpmChange, onMuteAll, onClearTracks, onVizToggle, onSavePiece, onLoadPiece }) {
  const [trashArmed, setTrashArmed] = useState(false);
  const trashTimer = useRef(null);
  const [saveEditing, setSaveEditing] = useState(false);
  const [saveName, setSaveName] = useState('');
  const saveInputRef = useRef(null);

  useEffect(() => {
    return () => { if (trashTimer.current) clearTimeout(trashTimer.current); };
  }, []);

  useEffect(() => {
    if (saveEditing && saveInputRef.current) {
      saveInputRef.current.focus();
      saveInputRef.current.select();
    }
  }, [saveEditing]);

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

  const handleSaveClick = () => {
    if (saveEditing) {
      handleSaveSubmit();
    } else {
      setSaveName(currentPiece || '');
      setSaveEditing(true);
    }
  };

  const handleSaveSubmit = () => {
    const name = saveName.trim() || currentPiece;
    if (name) onSavePiece(name);
    setSaveEditing(false);
  };

  const handleSaveCancel = () => {
    setSaveEditing(false);
  };

  const handleSaveKeyDown = (e) => {
    if (e.key === 'Enter') handleSaveSubmit();
    else if (e.key === 'Escape') handleSaveCancel();
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
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1.5 3.5h11M5 3.5V2a1 1 0 011-1h2a1 1 0 011 1v1.5M3 3.5l.5 8.5a1 1 0 001 1h5a1 1 0 001-1l.5-8.5M5.5 6v4M8.5 6v4" />
          </svg>
        </button>

        <button
          className="mixer-btn"
          onClick={handleSaveClick}
          onMouseDown={saveEditing ? (e) => e.preventDefault() : undefined}
          title={saveEditing ? 'Click to confirm save' : 'Save current session as piece'}
          style={{ color: saveEditing ? '#f44' : undefined, fontSize: '0.9rem', padding: '0 0.25rem' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="1" width="10" height="12" rx="1" />
            <path d="M4 1v4h6V1M4 8h6M4 10.5h3" />
          </svg>
        </button>

        {saveEditing ? (
          <input
            ref={saveInputRef}
            className="mixer-save-input"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={handleSaveKeyDown}
            onBlur={handleSaveCancel}
            placeholder="piece name"
          />
        ) : (
          <select
            className="mixer-select"
            value=""
            onChange={(e) => {
              if (e.target.value) onLoadPiece(e.target.value);
              e.target.value = '';
              e.target.blur();
            }}
            title="Load piece"
          >
            <option value="">{currentPiece || 'pieces'}</option>
            {(pieces || []).filter(name => name !== currentPiece).map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        )}
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

      {/* ── Right zone: BPM, connection status ── */}
      <div className="flex items-center gap-4" style={{ marginLeft: 'auto' }}>
        <input
          type="number"
          className="mixer-bpm-input"
          value={bpm ?? ''}
          onChange={(e) => onBpmChange(e.target.value)}
          placeholder="---"
          title="BPM"
        />
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
