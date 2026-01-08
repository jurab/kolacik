/*
Repl.jsx - <short description TODO>
Copyright (C) 2022 Strudel contributors - see <https://codeberg.org/uzu/strudel/src/branch/main/repl/src/App.js>
This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public License for more details. You should have received a copy of the GNU Affero General Public License along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { isIframe, isUdels } from './util.mjs';
import UdelsEditor from '@components/Udels/UdelsEditor';
import ReplEditor from './components/ReplEditor';
import EmbeddedReplEditor from './components/EmbeddedReplEditor';
import { useReplContext } from './useReplContext';
import { useSettings } from '@src/settings.mjs';
import { useStore } from '@nanostores/react';
import { $toast, useLogger } from './components/useLogger';

function Toast() {
  const toast = useStore($toast);
  if (!toast) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md px-4 py-3 rounded-lg shadow-lg bg-orange-600 text-white font-mono text-sm animate-pulse">
      {toast.message}
    </div>
  );
}

export function Repl({ embedded = false }) {
  const isEmbedded = embedded || isIframe();
  const Editor = isUdels() ? UdelsEditor : isEmbedded ? EmbeddedReplEditor : ReplEditor;
  const context = useReplContext();
  const { fontFamily } = useSettings();
  useLogger(); // Always listen for warnings/errors
  return (
    <>
      <Toast />
      <Editor context={context} style={{ fontFamily }} />
    </>
  );
}
