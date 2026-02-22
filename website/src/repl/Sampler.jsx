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
import { setInterval, clearInterval } from 'worker-timers';

let modulesLoading, presets, audioReady;

if (typeof window !== 'undefined') {
  audioReady = initAudioOnFirstClick();
  modulesLoading = loadModules();
  presets = prebake();
}

// ============================================================
// Available samples (local ones we can draw waveforms for)
// ============================================================

const SAMPLES = [
  { bank: 'hwr', label: 'hwr (vocal)', url: '/samples/hwr/0.wav' },
];

// ============================================================
// Defaults & param definitions
// ============================================================

const DEFAULTS = {
  begin: 0, end: 1, speed: 1, chop: 1,
  lpf: 20000, hpf: 20, vowel: 'none',
  gain: 1, room: 0, shape: 0, crush: 16, coarse: 1, pan: 0,
};

const PARAM_GROUPS = [
  {
    name: 'Region', params: [
      { key: 'begin', min: 0, max: 1, step: 0.01 },
      { key: 'end', min: 0, max: 1, step: 0.01 },
    ],
  },
  {
    name: 'Playback', params: [
      { key: 'speed', min: -2, max: 2, step: 0.01 },
      { key: 'chop', min: 1, max: 32, step: 1 },
    ],
  },
  {
    name: 'Filter', params: [
      { key: 'lpf', min: 100, max: 20000, step: 100, label: 'lpf (Hz)' },
      { key: 'hpf', min: 20, max: 5000, step: 20, label: 'hpf (Hz)' },
    ],
  },
  {
    name: 'Effects', params: [
      { key: 'gain', min: 0, max: 2, step: 0.01 },
      { key: 'room', min: 0, max: 1, step: 0.01 },
      { key: 'shape', min: 0, max: 0.9, step: 0.01 },
      { key: 'crush', min: 1, max: 16, step: 1 },
      { key: 'coarse', min: 1, max: 32, step: 1 },
      { key: 'pan', min: -1, max: 1, step: 0.01 },
    ],
  },
];

// ============================================================
// Code generation
// ============================================================

function generateCode(sample, params) {
  let code = `$: s("${sample}")`;

  if (params.begin > 0) code += `\n  .begin(${params.begin})`;
  if (params.end < 1) code += `\n  .end(${params.end})`;
  if (params.speed !== 1) code += `\n  .speed(${params.speed})`;
  if (params.chop > 1) code += `\n  .chop(${params.chop})`;
  if (params.lpf < 20000) code += `\n  .lpf(${params.lpf})`;
  if (params.hpf > 20) code += `\n  .hpf(${params.hpf})`;
  if (params.vowel !== 'none') code += `\n  .vowel("${params.vowel}")`;
  if (params.gain !== 1) code += `\n  .gain(${params.gain})`;
  if (params.room > 0) code += `\n  .room(${params.room}).roomsize(2)`;
  if (params.shape > 0) code += `\n  .shape(${params.shape})`;
  if (params.crush < 16) code += `\n  .crush(${params.crush})`;
  if (params.coarse > 1) code += `\n  .coarse(${params.coarse})`;
  if (params.pan !== 0) code += `\n  .pan(${params.pan})`;

  return code;
}

// ============================================================
// Waveform drawing
// ============================================================

function drawWaveform(canvas, audioBuffer, begin, end) {
  if (!canvas || !audioBuffer) return;
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  if (!width || !height) return;

  const data = audioBuffer.getChannelData(0);
  const len = data.length;
  const step = Math.ceil(len / width);

  ctx.clearRect(0, 0, width, height);

  // Draw full waveform dim
  ctx.fillStyle = '#333';
  const mid = height / 2;
  for (let i = 0; i < width; i++) {
    let min = 1.0, max = -1.0;
    const base = i * step;
    for (let j = 0; j < step && base + j < len; j++) {
      const d = data[base + j];
      if (d < min) min = d;
      if (d > max) max = d;
    }
    const y1 = mid + min * mid;
    const y2 = mid + max * mid;
    ctx.fillRect(i, y1, 1, Math.max(1, y2 - y1));
  }

  // Highlight active region
  const x1 = Math.floor(begin * width);
  const x2 = Math.floor(end * width);
  ctx.fillStyle = 'rgba(255, 204, 0, 0.15)';
  ctx.fillRect(x1, 0, x2 - x1, height);

  // Redraw waveform in active region bright
  ctx.fillStyle = '#ffcc00';
  for (let i = x1; i < x2 && i < width; i++) {
    let min = 1.0, max = -1.0;
    const base = i * step;
    for (let j = 0; j < step && base + j < len; j++) {
      const d = data[base + j];
      if (d < min) min = d;
      if (d > max) max = d;
    }
    const y1 = mid + min * mid;
    const y2 = mid + max * mid;
    ctx.fillRect(i, y1, 1, Math.max(1, y2 - y1));
  }

  // Draw begin/end markers
  ctx.strokeStyle = '#ffcc00';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x1, 0);
  ctx.lineTo(x1, height);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, 0);
  ctx.lineTo(x2, height);
  ctx.stroke();

  // Marker handles
  ctx.fillStyle = '#ffcc00';
  ctx.fillRect(x1 - 4, 0, 8, 12);
  ctx.fillRect(x2 - 4, 0, 8, 12);
}

// ============================================================
// Slider component
// ============================================================

function ParamSlider({ paramKey, label, min, max, step, value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <label className="w-16 text-xs font-mono text-foreground opacity-60 text-right shrink-0">
        {label || paramKey}
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(paramKey, parseFloat(e.target.value))}
        className="flex-1 h-1.5 accent-yellow-500 cursor-pointer"
      />
      <span className="w-14 text-xs font-mono text-foreground text-right shrink-0">
        {Number.isInteger(step) ? value : value.toFixed(2)}
      </span>
    </div>
  );
}

// ============================================================
// Main Sampler component
// ============================================================

export function Sampler() {
  const [sample, setSample] = useState('hwr');
  const [params, setParams] = useState({ ...DEFAULTS });
  const [audioBuffer, setAudioBuffer] = useState(null);
  const [started, setStarted] = useState(false);
  const [codeOverridden, setCodeOverridden] = useState(false);

  const masterRef = useRef(null);
  const masterContainerRef = useRef(null);
  const editorRef = useRef(null);
  const editorContainerRef = useRef(null);
  const canvasRef = useRef(null);
  const debounceRef = useRef(null);
  const paramsRef = useRef(params);
  const codeOverriddenRef = useRef(false);
  paramsRef.current = params;
  codeOverriddenRef.current = codeOverridden;

  // ---- Init master StrudelMirror (hidden, audio only) ----
  useEffect(() => {
    if (masterRef.current || !masterContainerRef.current) return;

    const drawContext = getDrawContext();
    const master = new StrudelMirror({
      defaultOutput: webaudioOutput,
      getTime: getAudioContextCurrentTime,
      setInterval,
      clearInterval,
      transpiler,
      autodraw: false,
      root: masterContainerRef.current,
      initialCode: '// sampler master',
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
  }, []);

  // ---- Init editor StrudelMirror (visible, code display) ----
  useEffect(() => {
    if (editorRef.current || !editorContainerRef.current) return;

    const drawContext = getDrawContext();
    const code = generateCode(sample, params);
    const editor = new StrudelMirror({
      defaultOutput: async () => {}, // silent
      getTime: getAudioContextCurrentTime,
      setInterval,
      clearInterval,
      transpiler,
      autodraw: false,
      root: editorContainerRef.current,
      initialCode: code,
      pattern: silence,
      drawTime: [-2, 2],
      drawContext,
      prebake: async () => Promise.all([modulesLoading, presets]),
      onUpdateState: () => {},
      bgFill: false,
      solo: false,
    });
    editorRef.current = editor;

    // Track code changes from user editing
    let _code = editor.code;
    Object.defineProperty(editor, 'code', {
      get() { return _code; },
      set(val) {
        _code = val;
        // If user edited the code manually, mark as overridden
        if (!editor._externalUpdate) {
          codeOverriddenRef.current = true;
          setCodeOverridden(true);
        }
      },
    });

    // Style the editor
    editor.setFontSize(14);
    const cmScroller = editorContainerRef.current.querySelector('.cm-scroller');
    if (cmScroller) {
      cmScroller.style.minHeight = '200px';
      cmScroller.style.overflow = 'auto';
    }
  }, []);

  // ---- Load audio buffer for waveform ----
  useEffect(() => {
    const sampleDef = SAMPLES.find(s => s.bank === sample);
    if (!sampleDef?.url) {
      setAudioBuffer(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(sampleDef.url);
        const buf = await resp.arrayBuffer();
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const decoded = await audioCtx.decodeAudioData(buf);
        if (!cancelled) setAudioBuffer(decoded);
      } catch (e) {
        console.error('Failed to load waveform:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [sample]);

  // ---- Draw waveform when buffer or region changes ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = 120 * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = '120px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    // Redraw at logical size
    drawWaveform(canvas, audioBuffer, params.begin, params.end);
  }, [audioBuffer, params.begin, params.end]);

  // ---- Waveform drag for begin/end ----
  const dragRef = useRef(null);

  const handleCanvasMouseDown = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const p = paramsRef.current;

    // Which marker is closer?
    const distBegin = Math.abs(x - p.begin);
    const distEnd = Math.abs(x - p.end);
    const threshold = 0.03;

    if (distBegin < threshold && distBegin <= distEnd) {
      dragRef.current = 'begin';
    } else if (distEnd < threshold) {
      dragRef.current = 'end';
    } else {
      // Click in the middle — set nearest marker
      dragRef.current = distBegin < distEnd ? 'begin' : 'end';
      handleParamChange(dragRef.current, Math.max(0, Math.min(1, parseFloat(x.toFixed(2)))));
    }
  }, []);

  const handleCanvasMouseMove = useCallback((e) => {
    if (!dragRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    handleParamChange(dragRef.current, parseFloat(x.toFixed(2)));
  }, []);

  const handleCanvasMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleCanvasMouseMove);
    window.addEventListener('mouseup', handleCanvasMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleCanvasMouseMove);
      window.removeEventListener('mouseup', handleCanvasMouseUp);
    };
  }, []);

  // ---- Parameter change handler ----
  const handleParamChange = useCallback((key, value) => {
    setParams(prev => {
      const next = { ...prev, [key]: value };
      // Ensure begin < end
      if (key === 'begin' && value >= next.end) next.begin = next.end - 0.01;
      if (key === 'end' && value <= next.begin) next.end = next.begin + 0.01;
      return next;
    });
    setCodeOverridden(false);
    codeOverriddenRef.current = false;
  }, []);

  // ---- Sync code to mirrors when params change ----
  useEffect(() => {
    if (codeOverriddenRef.current) return;

    const code = generateCode(sample, params);

    // Update editor display
    if (editorRef.current) {
      editorRef.current._externalUpdate = true;
      editorRef.current.setCode(code);
      editorRef.current._externalUpdate = false;
    }

    // Debounce master re-evaluation
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (masterRef.current) {
        masterRef.current.setCode(code);
        if (masterRef.current.repl.scheduler.started) {
          masterRef.current.evaluate();
        }
      }
    }, 200);
  }, [params, sample]);

  // ---- Transport ----
  const handlePlay = useCallback(() => {
    if (!masterRef.current) return;
    // If code was overridden, use editor code; otherwise use generated
    const code = codeOverriddenRef.current && editorRef.current
      ? editorRef.current.code
      : generateCode(sample, paramsRef.current);
    masterRef.current.setCode(code);
    masterRef.current.evaluate();
  }, [sample]);

  const handleStop = useCallback(() => {
    masterRef.current?.stop();
  }, []);

  // ---- Copy to clipboard ----
  const handleCopy = useCallback(() => {
    const code = editorRef.current?.code || generateCode(sample, paramsRef.current);
    navigator.clipboard.writeText(code);
  }, [sample]);

  // ---- Reset overrides ----
  const handleReset = useCallback(() => {
    setCodeOverridden(false);
    codeOverriddenRef.current = false;
    setParams({ ...DEFAULTS });
  }, []);

  // ---- Vowel selector ----
  const handleVowelChange = useCallback((e) => {
    handleParamChange('vowel', e.target.value);
  }, []);

  return (
    <div className="bg-background text-foreground min-h-screen">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-lineHighlight" style={{ backgroundColor: '#1a1a1a' }}>
        <span className="font-mono text-sm font-bold mr-2">sample sandbox</span>

        <select
          value={sample}
          onChange={(e) => setSample(e.target.value)}
          className="px-2 py-1 rounded text-sm font-mono bg-background text-foreground border border-lineHighlight cursor-pointer"
        >
          {SAMPLES.map(s => (
            <option key={s.bank} value={s.bank}>{s.label}</option>
          ))}
        </select>

        <button
          onClick={started ? handleStop : handlePlay}
          className={`px-3 py-1 rounded text-sm font-mono cursor-pointer ${
            started ? 'bg-green-700 text-white animate-pulse' : 'bg-background text-foreground hover:bg-green-700'
          }`}
        >
          {started ? '■ stop' : '▶ play'}
        </button>

        <button
          onClick={handleCopy}
          className="px-3 py-1 rounded text-sm font-mono bg-background text-foreground hover:bg-blue-700 cursor-pointer"
          title="Copy code to clipboard"
        >
          copy
        </button>

        <button
          onClick={handleReset}
          className="px-3 py-1 rounded text-sm font-mono bg-background text-foreground hover:bg-red-700 cursor-pointer"
          title="Reset all parameters"
        >
          reset
        </button>

        {codeOverridden && (
          <span className="text-xs font-mono text-yellow-500 ml-2">code edited manually — sliders disconnected</span>
        )}
      </div>

      {/* Main content: two columns */}
      <div className="flex" style={{ height: 'calc(100vh - 42px)' }}>
        {/* Left column: waveform + sliders */}
        <div className="w-1/2 border-r border-lineHighlight overflow-y-auto p-4 flex flex-col gap-4">
          {/* Waveform */}
          <div className="border border-lineHighlight rounded-md overflow-hidden bg-black">
            <canvas
              ref={canvasRef}
              onMouseDown={handleCanvasMouseDown}
              className="w-full cursor-crosshair"
              style={{ height: '120px', display: 'block' }}
            />
          </div>

          {/* Parameter groups */}
          {PARAM_GROUPS.map(group => (
            <details key={group.name} open>
              <summary className="font-mono text-sm font-bold text-foreground cursor-pointer select-none mb-2">
                {group.name}
              </summary>
              <div className="flex flex-col gap-2 pl-2">
                {group.params.map(p => (
                  <ParamSlider
                    key={p.key}
                    paramKey={p.key}
                    label={p.label}
                    min={p.min}
                    max={p.max}
                    step={p.step}
                    value={params[p.key]}
                    onChange={handleParamChange}
                  />
                ))}
                {group.name === 'Filter' && (
                  <div className="flex items-center gap-2">
                    <label className="w-16 text-xs font-mono text-foreground opacity-60 text-right shrink-0">vowel</label>
                    <select
                      value={params.vowel}
                      onChange={handleVowelChange}
                      className="px-2 py-0.5 rounded text-xs font-mono bg-background text-foreground border border-lineHighlight cursor-pointer"
                    >
                      <option value="none">none</option>
                      <option value="a">a</option>
                      <option value="e">e</option>
                      <option value="i">i</option>
                      <option value="o">o</option>
                      <option value="u">u</option>
                    </select>
                  </div>
                )}
              </div>
            </details>
          ))}
        </div>

        {/* Right column: code editor */}
        <div className="w-1/2 flex flex-col">
          <div className="bg-lineHighlight px-3 py-1.5">
            <span className="font-mono text-sm font-bold text-foreground">generated code</span>
          </div>
          <div
            ref={editorContainerRef}
            className="flex-1 overflow-auto"
            style={{ fontFamily: '"Operator Mono SSm Lig", monospace' }}
          />
        </div>
      </div>

      {/* Hidden master repl — handles all audio */}
      <div ref={masterContainerRef} className="overflow-hidden h-0" />
    </div>
  );
}
