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

  const nameColor = solo
    ? 'var(--mixer-accent)'
    : effectivelyMuted
      ? '#f44'
      : 'var(--mixer-status-ok)';

  return (
    <div
      className={`mixer-track overflow-hidden ${effectivelyMuted && !vizMode ? 'mixer-track-muted' : ''}`}
      style={{
        background: 'var(--mixer-panel)',
        border: '1px solid var(--mixer-border)',
        borderRadius: 4,
        opacity: vizMode ? 0.5 : undefined,
        transition: 'opacity 0.3s ease',
      }}
    >
      <div className="flex items-center justify-between px-3 py-1">
        <span style={{ fontFamily: 'var(--mixer-font)', fontSize: '0.85rem', color: nameColor }}>
          {group != null && <span style={{ color: nameColor, opacity: 0.6 }}>{group}:</span>}
          {id}
        </span>

        <div
          className="mixer-track-controls flex gap-1 items-center"
          style={{ opacity: vizMode ? 0 : undefined, pointerEvents: vizMode ? 'none' : undefined }}
        >
          <select
            className="mixer-select"
            value={viz || ''}
            onChange={(e) => onVizChange(id, e.target.value || null)}
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
            className="mixer-select"
            value={fx || ''}
            onChange={(e) => onFxChange(id, e.target.value || null)}
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
            className="mixer-select"
            value={group ?? ''}
            onChange={(e) => onGroupChange(id, e.target.value === '' ? null : Number(e.target.value))}
            title="Group (number key to toggle mute)"
            style={{ width: '2rem', textAlign: 'center' }}
          >
            <option value="">-</option>
            {[0,1,2,3,4,5,6,7,8,9].map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>

          <button
            className="mixer-btn"
            onClick={() => onMute(id)}
            style={{ color: muted ? '#f44' : undefined }}
          >
            M
          </button>

          <button
            className="mixer-btn"
            onClick={() => onSolo(id)}
            style={{ color: solo ? 'var(--mixer-accent)' : undefined }}
          >
            S
          </button>

          <button
            className="mixer-btn"
            onClick={() => onRemove(id)}
            style={{ color: undefined }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#f44'}
            onMouseLeave={(e) => e.currentTarget.style.color = ''}
          >
            ×
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="min-h-[60px]"
        style={{ fontFamily: 'var(--mixer-font)', opacity: vizMode ? 0.5 : 0.85, transition: 'opacity 0.3s ease' }}
      />
    </div>
  );
}
