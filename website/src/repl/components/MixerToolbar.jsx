export function MixerToolbar({ started, connected, bpm, vizMode, onPlay, onStop, onBpmChange, onMuteAll, onAddTrack, onVizToggle }) {
  return (
    <div id="mixer-toolbar" className="fixed top-0 left-0 right-0 z-10 flex items-center gap-2 px-4 py-2 border-b border-lineHighlight" style={{ backgroundColor: '#1a1a1a' }}>
      <span className="font-mono text-sm font-bold mr-2">kolacik mixer</span>

      <button
        id="btn-play"
        onClick={started ? onStop : onPlay}
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
          value={bpm ?? ''}
          onChange={(e) => onBpmChange(e.target.value)}
          placeholder="auto"
          className="w-16 px-1 py-0.5 rounded text-sm font-mono bg-background text-foreground border border-lineHighlight"
        />
      </div>

      <button
        id="btn-mute-all"
        onClick={onMuteAll}
        className="px-3 py-1 rounded text-sm font-mono bg-background text-foreground hover:bg-red-700 cursor-pointer"
      >
        mute all
      </button>

      <button
        id="btn-add-track"
        onClick={onAddTrack}
        className="px-3 py-1 rounded text-sm font-mono bg-background text-foreground hover:bg-green-700 cursor-pointer ml-auto"
      >
        + track
      </button>

      <button
        onClick={onVizToggle}
        className={`px-3 py-1 rounded text-sm font-mono cursor-pointer ${
          vizMode ? 'bg-purple-700 text-white' : 'bg-background text-foreground hover:bg-purple-700'
        }`}
        title="Toggle viz mode (V)"
      >
        {vizMode ? '◉ viz' : '○ viz'}
      </button>

      <div id="sync-status" className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} title={connected ? 'connected' : 'disconnected'} />
    </div>
  );
}
