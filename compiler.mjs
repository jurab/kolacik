// compiler.mjs — Pure track compilation: (tracks, mixState) → Strudel code string

export function compile(tracks, mixState = {}) {
  let code = '';
  const { muted = [], solo = [], bpm, globalFx } = mixState;
  const hasSolo = solo.length > 0;

  if (bpm) code += `setcpm(${bpm}/4)\n\n`;

  const sortedIds = Object.keys(tracks).sort();

  for (const id of sortedIds) {
    const isMuted = muted.includes(id);
    const isSoloed = solo.includes(id);
    const shouldMute = isMuted || (hasSolo && !isSoloed);

    code += `// == ${id} ==\n`;
    let trackCode = tracks[id].trim();
    if (shouldMute) {
      trackCode = trackCode.replace(/^\$:/, '_$:');
    }
    const orbitIndex = sortedIds.indexOf(id);
    trackCode += `.tag('${id}').orbit(${orbitIndex})`;
    code += trackCode + '\n\n';
  }

  if (globalFx?.trim()) {
    code += `// == global fx ==\n${globalFx.trim()}\n`;
  }

  return code;
}
