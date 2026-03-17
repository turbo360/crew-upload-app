import { app, BrowserWindow, ipcMain, dialog, shell, Menu, powerMonitor } from 'electron';
import * as path from 'path';
import * as https from 'https';
import { autoUpdater } from 'electron-updater';

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Crew Upload',
    icon: path.join(__dirname, '../build/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    backgroundColor: '#111827',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Intercept crew-upload://go-home to navigate back to portal picker
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url === 'crew-upload://go-home') {
      event.preventDefault();
      if (isDev) {
        mainWindow!.loadURL('http://localhost:5173');
      } else {
        mainWindow!.loadFile(path.join(__dirname, '../dist/index.html'));
      }
    }
  });
}

function createMenu() {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        {
          label: 'Check for Updates...',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('check-for-updates-clicked');
            }
            if (!isDev) {
              autoUpdater.checkForUpdates().catch(err => {
                console.log('Error checking for updates:', err);
              });
            }
          }
        },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const }
      ]
    }] : []),
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(isMac ? [
          { type: 'separator' as const },
          { role: 'front' as const }
        ] : [
          { role: 'close' as const }
        ])
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates...',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('check-for-updates-clicked');
            }
            if (!isDev) {
              autoUpdater.checkForUpdates().catch(err => {
                console.log('Error checking for updates:', err);
              });
            }
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  createMenu();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// ============================================
// AUTO-UPDATER
// ============================================

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function setupAutoUpdater() {
  if (isDev) {
    console.log('Skipping auto-updater in development mode');
    return;
  }

  autoUpdater.checkForUpdates().catch(err => {
    console.log('Error checking for updates:', err);
  });

  setInterval(() => {
    autoUpdater.checkForUpdates().catch(err => {
      console.log('Error checking for updates:', err);
    });
  }, 4 * 60 * 60 * 1000);
}

autoUpdater.on('update-available', (info) => {
  console.log('Update available:', info.version);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-available', {
      version: info.version,
      releaseNotes: info.releaseNotes
    });
  }
});

autoUpdater.on('update-not-available', () => {
  console.log('No updates available');
});

autoUpdater.on('download-progress', (progress) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-download-progress', {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total
    });
  }
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('Update downloaded:', info.version);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-downloaded', {
      version: info.version
    });
  }
});

autoUpdater.on('error', (err) => {
  console.error('Auto-updater error:', err);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-error', {
      error: err.message
    });
  }
});

ipcMain.handle('check-for-updates', async () => {
  if (isDev) {
    return { updateAvailable: false, isDev: true };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    return { updateAvailable: result?.updateInfo?.version !== app.getVersion() };
  } catch (err: any) {
    return { error: err.message };
  }
});

ipcMain.handle('download-update', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
});

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall(false, true);
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

app.whenReady().then(() => {
  setupAutoUpdater();
});

// ============================================
// MASV CREDENTIALS (obfuscated)
// ============================================

const _k = 'T360CrewUpload';
function _d(enc: number[]): string {
  return enc.map((c, i) => String.fromCharCode(c ^ _k.charCodeAt(i % _k.length))).join('');
}
const _E = [62,82,91,85,48,50,17,2,39,18,3,65,15,1,32,29,87,69];
const _P = [48,94,81,3,51,3,21,90,31,36,61,89,3,3,32,10,64,73,41];

let _cachedToken: string | null = null;
let _cachedTeamId: string | null = null;

function masvRequest(
  urlPath: string,
  method: string,
  headers: Record<string, string>,
  body?: Buffer
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const fullUrl = urlPath.startsWith('http') ? urlPath : `https://api.massive.app${urlPath}`;
    const parsedUrl = new URL(fullUrl);

    const options: https.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ statusCode: res.statusCode || 0, body: data });
      });
    });

    req.setTimeout(30000, () => req.destroy(new Error('Request timeout')));
    req.on('error', reject);

    if (body) req.write(body);
    req.end();
  });
}

async function getMasvAuth(): Promise<{ token: string; teamId: string }> {
  if (_cachedToken && _cachedTeamId) {
    return { token: _cachedToken, teamId: _cachedTeamId };
  }
  return refreshMasvAuth();
}

async function refreshMasvAuth(): Promise<{ token: string; teamId: string }> {
  const postData = JSON.stringify({ email: _d(_E), password: _d(_P) });

  const response = await masvRequest('/v1/auth', 'POST', {
    'Content-Type': 'application/json',
    'Content-Length': String(Buffer.byteLength(postData))
  }, Buffer.from(postData));

  if (response.statusCode !== 200) {
    throw new Error(`MASV login failed: ${response.statusCode} ${response.body}`);
  }

  const auth = JSON.parse(response.body);
  _cachedToken = auth.token;
  _cachedTeamId = auth.teams[0].id;
  return { token: _cachedToken!, teamId: _cachedTeamId! };
}

// ============================================
// MASV PORTAL LIST
// ============================================

ipcMain.handle('fetch-masv-portals', async () => {
  try {
    let auth = await getMasvAuth();
    let response = await masvRequest(
      `/v1/teams/${auth.teamId}/portals`,
      'GET',
      { 'X-User-Token': auth.token }
    );

    if (response.statusCode === 401) {
      auth = await refreshMasvAuth();
      response = await masvRequest(
        `/v1/teams/${auth.teamId}/portals`,
        'GET',
        { 'X-User-Token': auth.token }
      );
    }

    if (response.statusCode !== 200) {
      return { success: false, error: `Failed to fetch portals: ${response.statusCode} ${response.body}` };
    }

    const portals = JSON.parse(response.body);
    return { success: true, portals };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// ============================================
// LOAD PORTAL IN MAIN WINDOW
// ============================================

ipcMain.handle('open-portal', async (_, subdomain: string) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const portalUrl = `https://${subdomain}.portal.massive.io`;
  mainWindow.loadURL(portalUrl);

  // Inject a floating "Back" button once the portal page loads
  mainWindow.webContents.once('did-finish-load', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.executeJavaScript(`
      (function() {
        if (document.getElementById('crew-back-btn')) return;
        const btn = document.createElement('button');
        btn.id = 'crew-back-btn';
        btn.textContent = 'Back to Events';
        btn.style.cssText = 'position:fixed;top:12px;left:80px;z-index:999999;padding:6px 16px;background:#f97316;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:-apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.3);transition:background 0.15s;-webkit-app-region:no-drag;';
        btn.onmouseenter = function() { btn.style.background='#ea580c'; };
        btn.onmouseleave = function() { btn.style.background='#f97316'; };
        btn.onclick = function() {
          // Use IPC to go back - postMessage to main process
          window.location.href = 'crew-upload://go-home';
        };
        document.body.appendChild(btn);
      })();
    `).catch(() => {});
  });
});

ipcMain.handle('go-home', async () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
});
