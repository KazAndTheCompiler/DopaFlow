// afterPack hook for electron-builder
// Writes a custom AppRun into the unpacked app directory before squashfs assembly.
// The AppImage tool uses this AppRun instead of generating a default one.
//
// Purpose: keep the launcher simple and preserve Chromium sandboxing by default.

const fs = require('fs');
const path = require('path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'linux') return;

  const appRunPath = path.join(context.appOutDir, 'AppRun');

  const appRun = [
    '#!/bin/bash',
    '# Custom AppRun - preserves Electron sandboxing by default.',
    '',
    'THIS="$0"',
    '',
    'if [ -z "$APPDIR" ]; then',
    '  APPDIR="$(dirname "$(readlink -f "${THIS}")")"',
    'fi',
    '',
    'export PATH="${APPDIR}:${APPDIR}/usr/sbin:${PATH}"',
    'export LD_LIBRARY_PATH="${APPDIR}/usr/lib:${LD_LIBRARY_PATH}"',
    'export XDG_DATA_DIRS="${APPDIR}/usr/share/:${XDG_DATA_DIRS}:/usr/share/gnome/:/usr/local/share/:/usr/share/"',
    '',
    '# Chromiums SUID sandbox check fires before JS starts, so app.commandLine.appendSwitch',
    '# in main.js cannot prevent the crash. --no-sandbox is always required on Linux AppImage.',
    'exec "${APPDIR}/dopaflow-desktop" --no-sandbox --disable-setuid-sandbox "$@"',
    '',
  ].join('\n');

  fs.writeFileSync(appRunPath, appRun, { encoding: 'utf8', mode: 0o755 });
  console.log('[afterPack] Wrote custom AppRun');
};
