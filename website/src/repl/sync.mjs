// Kolacik sync - bidirectional file sync with Claude
const SYNC_URL = 'ws://localhost:4322';

let ws = null;
let editor = null;
let lastSentContent = '';
let ignoreNextUpdate = false;

export function initSync(strudelMirror) {
  editor = strudelMirror;
  connect();
}

function connect() {
  try {
    ws = new WebSocket(SYNC_URL);

    ws.onopen = () => {
      console.log('🍪 Kolacik sync connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'code' && msg.content !== lastSentContent) {
          console.log('🍪 Receiving code from file');
          ignoreNextUpdate = true;
          editor.setCode(msg.content);
          lastSentContent = msg.content;
        }
      } catch (e) {
        console.error('Sync parse error:', e);
      }
    };

    ws.onclose = () => {
      console.log('🍪 Kolacik sync disconnected, retrying in 2s...');
      setTimeout(connect, 2000);
    };

    ws.onerror = () => {
      // Will trigger onclose
    };
  } catch (e) {
    console.log('🍪 Sync server not running');
    setTimeout(connect, 2000);
  }
}

export function sendCode(content) {
  if (ignoreNextUpdate) {
    ignoreNextUpdate = false;
    return;
  }
  if (ws?.readyState === 1 && content !== lastSentContent) {
    lastSentContent = content;
    ws.send(JSON.stringify({ type: 'code', content }));
  }
}
