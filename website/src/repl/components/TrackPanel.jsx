import { useEffect, useRef } from 'react';
import { silence } from '@strudel/core';
import { getPunchcardPainter } from '@strudel/draw';
import { transpiler } from '@strudel/transpiler';
import { getAudioContextCurrentTime } from '@strudel/webaudio';
import { StrudelMirror } from '@strudel/codemirror';
import { setInterval, clearInterval } from 'worker-timers';

export function TrackPanel({ id, code, muted, solo, group, effectivelyMuted, fx, viz, started, vizMode, modulesLoading, presets, onCodeChange, onMute, onSolo, onRemove, onGroupChange, onVizChange, onFxChange }) {
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

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0';
    containerRef.current.style.position = 'relative';
    containerRef.current.appendChild(canvas);
    canvasRef.current = canvas;

    const rect = containerRef.current.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    const drawTime = [-2, 2];

    const mirror = new StrudelMirror({
      root: containerRef.current,
      initialCode: code,
      defaultOutput: async () => {},
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
        if (!on && canvasRef.current) {
          const c = canvasRef.current.getContext('2d');
          c.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
      },
    });
    mirrorRef.current = mirror;

    mirror.setFontSize(14);

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

    let _mirrorCode = mirror.code;
    Object.defineProperty(mirror, 'code', {
      get() { return _mirrorCode; },
      set(val) {
        _mirrorCode = val;
        codeRef.current = val;
        if (!externalRef.current) {
          onCodeChangeRef.current(id, val);
        }
        if (evalTimerRef.current) clearTimeout(evalTimerRef.current);
        evalTimerRef.current = setTimeout(() => {
          if (mirrorRef.current) {
            mirrorRef.current.repl.evaluate(mirrorRef.current.code, startedRef.current);
          }
        }, 500);
      },
    });

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

  // Sync external code changes
  useEffect(() => {
    if (mirrorRef.current && code !== codeRef.current) {
      codeRef.current = code;
      externalRef.current = true;
      mirrorRef.current.setCode(code);
      externalRef.current = false;
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

  // Re-evaluate when viz type changes
  useEffect(() => {
    if (!mirrorRef.current) return;
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
