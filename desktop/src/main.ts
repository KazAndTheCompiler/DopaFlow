import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as log from 'electron-log';

// Keep references to prevent garbage collection
let mainWindow: BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;

// Backend port - configurable
const BACKEND_PORT = process.env.DOPAFLOW_BACKEND_PORT || '8000';

function startBackend(): Promise<void> {
  return new Promise((resolve, reject) => {
    const isDev = !app.isPackaged;
    
    // In dev, assume backend is running separately
    if (isDev) {
      log.info('Development mode: assuming backend is running separately');
      resolve();
      return;
    }

    // In production, spawn the bundled backend
    const backendPath = path.join(process.resourcesPath, 'backend', 'dopaflow-backend');
    log.info('Starting backend from:', backendPath);

    backendProcess = spawn(backendPath, [], {
      env: {
        ...process.env,
        PORT: BACKEND_PORT,
        DOPAFLOW_DATA_DIR: path.join(app.getPath('userData'), 'data'),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    backendProcess.stdout?.on('data', (data) => {
      log.info('Backend stdout:', data.toString());
    });

    backendProcess.stderr?.on('data', (data) => {
      log.error('Backend stderr:', data.toString());
    });

    backendProcess.on('error', (err) => {
      log.error('Failed to start backend:', err);
      reject(err);
    });

    backendProcess.on('exit', (code) => {
      log.info('Backend exited with code:', code);
      backendProcess = null;
    });

    // Wait a bit for backend to start
    setTimeout(() => {
      log.info('Backend should be ready on port', BACKEND_PORT);
      resolve();
    }, 2000);
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'default',
    show: false,
  });

  // Load frontend
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    const frontendPath = path.join(process.resourcesPath, 'frontend', 'index.html');
    mainWindow.loadFile(frontendPath);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(async () => {
  try {
    await startBackend();
    createWindow();
  } catch (err) {
    log.error('Failed to start app:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
});

// IPC handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-backend-port', () => {
  return BACKEND_PORT;
});
