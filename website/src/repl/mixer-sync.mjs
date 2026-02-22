// Mixer sync client — connects to sync-server.mjs for multi-track mixer
const SYNC_URL = 'ws://localhost:4322';

let ws = null;
let onMessage = null;

export function initMixerSync(messageHandler) {
  onMessage = messageHandler;
  connect();
}

function connect() {
  try {
    ws = new WebSocket(SYNC_URL);

    ws.onopen = () => {
      console.log('🎛️ Mixer sync connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        // Only handle mixer-related and piece-related messages
        if (msg.type?.startsWith('mixer:') || msg.type?.startsWith('pieces:') || msg.type === 'play' || msg.type === 'stop' || msg.type === 'toggle' || msg.type === 'play-once') {
          onMessage?.(msg);
        }
      } catch (e) {
        console.error('Mixer sync parse error:', e);
      }
    };

    ws.onclose = () => {
      console.log('🎛️ Mixer sync disconnected, retrying in 2s...');
      setTimeout(connect, 2000);
    };

    ws.onerror = () => {};
  } catch (e) {
    console.log('🎛️ Sync server not running');
    setTimeout(connect, 2000);
  }
}

export function sendTrackCode(id, code) {
  send({ type: 'mixer:track', id, code });
}

export function sendAddTrack(id, code) {
  send({ type: 'mixer:track:add', id, code });
}

export function sendRemoveTrack(id) {
  send({ type: 'mixer:track:remove', id });
}

export function sendMixerState(state) {
  send({ type: 'mixer:state', state });
}

export function sendError(message, type = 'error') {
  send({ type, message });
}

export function sendDebug(msg) {
  send({ type: 'debug', msg });
}

export function sendSavePiece(name) {
  send({ type: 'pieces:save', name });
}

export function sendLoadPiece(name) {
  send({ type: 'pieces:load', name });
}

export function sendDeletePiece(name) {
  send({ type: 'pieces:delete', name });
}

function send(data) {
  if (ws?.readyState === 1) {
    ws.send(JSON.stringify(data));
  }
}
