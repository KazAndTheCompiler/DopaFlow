// afterPack hook for electron-builder
// Writes a custom AppRun into the unpacked app directory before squashfs assembly.
// The AppImage tool uses this AppRun instead of generating a default one.
//
// Purpose: keep the launcher simple and preserve Chromium sandboxing by default.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const VENDORED_LIB_DIR = path.join(__dirname, 'vendor-runtime', 'extract', 'usr', 'lib', 'x86_64-linux-gnu');
const REQUIRED_RUNTIME_LIBS = [
  'libasound.so.2',
  'libavahi-client.so.3',
  'libavahi-common.so.3',
  'libatk-1.0.so.0',
  'libatk-bridge-2.0.so.0',
  'libatspi.so.0',
  'libcairo.so.2',
  'libcairo-gobject.so.2',
  'libcups.so.2',
  'libepoxy.so.0',
  'libfontconfig.so.1',
  'libfribidi.so.0',
  'libgdk-3.so.0',
  'libgdk_pixbuf-2.0.so.0',
  'libgbm.so.1',
  'libgtk-3.so.0',
  'libharfbuzz.so.0',
  'libjpeg.so.8',
  'libnss3.so',
  'libnssutil3.so',
  'libsmime3.so',
  'libssl3.so',
  'libnspr4.so',
  'libpango-1.0.so.0',
  'libpangocairo-1.0.so.0',
  'libpangoft2-1.0.so.0',
  'libplds4.so',
  'libplc4.so',
  'libthai.so.0',
  'libX11.so.6',
  'libXcomposite.so.1',
  'libXdamage.so.1',
  'libXext.so.6',
  'libXfixes.so.3',
  'libXi.so.6',
  'libXrandr.so.2',
  'libxcb.so.1',
  'libXrender.so.1',
];

const OPTIONAL_RUNTIME_LIBS = [
  'libXau.so.6',
  'libXcursor.so.1',
  'libXdmcp.so.6',
  'libXinerama.so.1',
  'libxcb-render.so.0',
  'libxcb-shm.so.0',
  'libdatrie.so.1',
  'libgraphite2.so.3',
  'libpixman-1.so.0',
  'libwayland-client.so.0',
  'libwayland-cursor.so.0',
  'libwayland-egl.so.1',
];

function resolveLibraryPath(libName) {
  const vendoredPath = path.join(VENDORED_LIB_DIR, libName);
  if (fs.existsSync(vendoredPath)) {
    return vendoredPath;
  }
  const output = execFileSync('/usr/sbin/ldconfig', ['-p'], { encoding: 'utf8' });
  const line = output
    .split('\n')
    .find((entry) => entry.includes(` ${libName} `) || entry.includes(`\t${libName} `));
  if (!line) {
    throw new Error(`Could not resolve ${libName} from ldconfig cache`);
  }
  const match = line.match(/=>\s+(.+)$/);
  if (!match) {
    throw new Error(`Could not parse ldconfig entry for ${libName}: ${line}`);
  }
  let resolvedPath = match[1].trim();
  if (!fs.existsSync(resolvedPath) && resolvedPath.startsWith('/lib/')) {
    const altPath = path.join('/usr/lib', resolvedPath.slice('/lib/'.length));
    if (fs.existsSync(altPath)) {
      resolvedPath = altPath;
    }
  }
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Resolved path for ${libName} does not exist: ${resolvedPath}`);
  }
  return resolvedPath;
}

function tryResolveLibraryPath(libName) {
  try {
    return resolveLibraryPath(libName);
  } catch (error) {
    console.warn(`[afterPack] Optional runtime library unavailable: ${libName} (${error.message})`);
    return null;
  }
}

function copyBundledRuntimeLibs(appOutDir) {
  const libDir = path.join(appOutDir, 'usr', 'lib');
  fs.mkdirSync(libDir, { recursive: true });

  for (const libName of REQUIRED_RUNTIME_LIBS) {
    const sourcePath = resolveLibraryPath(libName);
    const targetPath = path.join(libDir, libName);
    fs.copyFileSync(sourcePath, targetPath);
  }

  for (const libName of OPTIONAL_RUNTIME_LIBS) {
    const sourcePath = tryResolveLibraryPath(libName);
    if (!sourcePath) continue;
    const targetPath = path.join(libDir, libName);
    fs.copyFileSync(sourcePath, targetPath);
  }
}

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'linux') return;

  copyBundledRuntimeLibs(context.appOutDir);

  const appRunPath = path.join(context.appOutDir, 'AppRun');

  const appRun = [
    '#!/bin/bash',
    '# Custom AppRun - normalizes the host environment before Electron starts.',
    '',
    'THIS="$0"',
    '',
    'if [ -z "$APPDIR" ]; then',
    '  APPDIR="$(dirname "$(readlink -f "${THIS}")")"',
    'fi',
    '',
    'export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${APPDIR}:${APPDIR}/usr/sbin"',
    'export LD_LIBRARY_PATH="${APPDIR}/usr/lib:/lib/x86_64-linux-gnu:/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:${LD_LIBRARY_PATH}}"',
    'export XDG_DATA_DIRS="${APPDIR}/usr/share/:${XDG_DATA_DIRS}:/usr/share/gnome/:/usr/local/share/:/usr/share/"',
    'unset SNAP SNAP_NAME SNAP_REVISION SNAP_ARCH SNAP_COMMON SNAP_USER_COMMON SNAP_DATA SNAP_USER_DATA SNAP_INSTANCE_NAME SNAP_INSTANCE_KEY SNAP_REAL_HOME SNAP_CONTEXT',
    '',
    '# Use direct exec (not ld-linux --library-path) so /proc/self/exe resolves correctly',
    '# for Electron resource discovery (icudtl.dat etc.). LD_LIBRARY_PATH handles lib lookup.',
    '# --no-sandbox is required: Chromium SUID sandbox check fires before JS starts.',
    'exec "${APPDIR}/dopaflow-desktop" --no-sandbox --disable-setuid-sandbox "$@"',
    '',
  ].join('\n');

  fs.writeFileSync(appRunPath, appRun, { encoding: 'utf8', mode: 0o755 });
  console.log('[afterPack] Wrote custom AppRun');
};
