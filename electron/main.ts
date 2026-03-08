import { app, BrowserWindow, ipcMain, dialog, shell, Menu, powerMonitor } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';
import { autoUpdater } from 'electron-updater';

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Crew Upload - Turbo 360',
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
      label: 'File',
      submenu: [
        isMac ? { role: 'close' as const } : { role: 'quit' as const }
      ]
    },
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

  // Check for updates on startup
  autoUpdater.checkForUpdates().catch(err => {
    console.log('Error checking for updates:', err);
  });

  // Check for updates every 4 hours
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

// IPC handlers for update control
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

// Initialize auto-updater after app is ready
app.whenReady().then(() => {
  setupAutoUpdater();
});

// IPC Handlers for native file dialogs
ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile', 'multiSelections']
    // No filters - allow all file types
  });

  if (result.canceled) return [];

  return result.filePaths.map(filePath => ({
    path: filePath,
    name: path.basename(filePath),
    size: fs.statSync(filePath).size,
    type: getFileType(filePath)
  }));
});

ipcMain.handle('select-folders', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory', 'multiSelections']
  });

  if (result.canceled) return [];

  const files: any[] = [];

  for (const folderPath of result.filePaths) {
    const folderFiles = getAllFiles(folderPath, folderPath);
    files.push(...folderFiles);
  }

  return files;
});

ipcMain.handle('get-file-size', async (_, filePath: string) => {
  return fs.statSync(filePath).size;
});

// Expand a path - if it's a directory, return all files inside; if it's a file, return file info
ipcMain.handle('expand-path', async (_, filePath: string) => {
  const stat = fs.statSync(filePath);

  if (stat.isDirectory()) {
    // Return all files in the directory recursively
    return getAllFiles(filePath, filePath);
  } else {
    // Return single file info
    return [{
      path: filePath,
      name: path.basename(filePath),
      relativePath: path.basename(filePath),
      size: stat.size,
      type: getFileType(filePath)
    }];
  }
});

// Helper to get all files from a directory recursively
function getAllFiles(dirPath: string, basePath: string): any[] {
  const files: any[] = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.name.startsWith('.') || entry.name.startsWith('._')) continue;

    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath, basePath));
    } else {
      const relativePath = path.relative(basePath, fullPath);
      files.push({
        path: fullPath,
        name: entry.name,
        relativePath: relativePath,
        size: fs.statSync(fullPath).size,
        type: getFileType(fullPath)
      });
    }
  }

  return files;
}

function getFileType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
    '.mxf': 'application/mxf',
    '.r3d': 'video/x-r3d',
    '.braw': 'video/x-braw',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.pdf': 'application/pdf',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// ============================================
// NATIVE TUS UPLOAD IMPLEMENTATION
// Upload happens entirely in main process - no IPC for file data
// ============================================

interface UploadState {
  uploadUrl?: string;
  offset: number;
  isPaused: boolean;
  isAborted: boolean;
}

const activeUploads: Map<string, UploadState> = new Map();
const CHUNK_SIZE = 100 * 1024 * 1024; // 100MB chunks - balance of speed (fewer HTTP round-trips) and progress visibility
const PARALLEL_STREAMS = 4; // Number of parallel streams for large files
const PARALLEL_THRESHOLD = 500 * 1024 * 1024; // 500MB - files larger than this use parallel upload
const MAX_RETRIES = 5;
const RETRY_DELAYS = [1000, 3000, 10000, 20000, 30000]; // Extended backoff

// HTTP agents with keep-alive for connection reuse and optimized for uploads
const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 16,
  maxFreeSockets: 8,
  timeout: 300000,
  scheduling: 'fifo',
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 16,
  maxFreeSockets: 8,
  timeout: 300000,
  scheduling: 'fifo',
});

// Upload logging
interface UploadLog {
  timestamp: string;
  uploadId: string;
  filename: string;
  status: 'started' | 'completed' | 'failed' | 'retrying';
  error?: string;
  duration?: number;
  size?: number;
}

const uploadLogs: UploadLog[] = [];

let logWritePending = false;
function logUpload(log: UploadLog) {
  uploadLogs.push(log);
  console.log(`[Upload ${log.status}] ${log.filename}${log.error ? ` - ${log.error}` : ''}`);
  if (!logWritePending) {
    logWritePending = true;
    process.nextTick(() => {
      logWritePending = false;
      const logPath = path.join(app.getPath('userData'), 'upload-log.json');
      fs.writeFile(logPath, JSON.stringify(uploadLogs, null, 2), () => {});
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function sendProgress(uploadId: string, bytesUploaded: number, bytesTotal: number) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('upload-progress', { uploadId, bytesUploaded, bytesTotal });
  }
}

function sendHeartbeat(uploadId: string) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('upload-heartbeat', { uploadId });
  }
}

const activeHeartbeats: Map<string, ReturnType<typeof setInterval>> = new Map();

function startHeartbeat(uploadId: string) {
  stopHeartbeat(uploadId);
  const interval = setInterval(() => sendHeartbeat(uploadId), 5000);
  activeHeartbeats.set(uploadId, interval);
}

function stopHeartbeat(uploadId: string) {
  const interval = activeHeartbeats.get(uploadId);
  if (interval) {
    clearInterval(interval);
    activeHeartbeats.delete(uploadId);
  }
}

function sendComplete(uploadId: string) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('upload-complete', { uploadId });
  }
}

function getUserFriendlyError(error: string): string {
  const lowerError = error.toLowerCase();

  // Network errors
  if (lowerError.includes('enotfound') || lowerError.includes('getaddrinfo')) {
    return 'Unable to connect to server. Please check your internet connection.';
  }
  if (lowerError.includes('econnrefused')) {
    return 'Server is not responding. Please try again later.';
  }
  if (lowerError.includes('econnreset') || lowerError.includes('socket hang up')) {
    return 'Connection was interrupted. The upload will retry automatically.';
  }
  if (lowerError.includes('etimedout') || lowerError.includes('timeout')) {
    return 'Connection timed out. Please check your internet and try again.';
  }
  if (lowerError.includes('network') || lowerError.includes('offline')) {
    return 'Network error. Please check your internet connection.';
  }

  // Auth errors
  if (lowerError.includes('token expired') || lowerError.includes('token invalid')) {
    return 'Your session has expired. Please log in again.';
  }
  if (lowerError.includes('unauthorized') || lowerError.includes('401')) {
    return 'Session expired. Please log in again.';
  }
  if (lowerError.includes('403') || lowerError.includes('forbidden')) {
    return 'Access denied. Please check your permissions.';
  }

  // Server errors
  if (lowerError.includes('500') || lowerError.includes('internal server')) {
    return 'Server error. Please try again in a moment.';
  }
  if (lowerError.includes('502') || lowerError.includes('bad gateway')) {
    return 'Server is temporarily unavailable. Please try again.';
  }
  if (lowerError.includes('503') || lowerError.includes('service unavailable')) {
    return 'Server is busy. Please try again in a moment.';
  }
  if (lowerError.includes('504') || lowerError.includes('gateway timeout')) {
    return 'Server took too long to respond. Please try again.';
  }

  // File errors
  if (lowerError.includes('enoent') || lowerError.includes('no such file')) {
    return 'File not found. It may have been moved or deleted.';
  }
  if (lowerError.includes('eacces') || lowerError.includes('permission denied')) {
    return 'Cannot access file. Please check file permissions.';
  }
  if (lowerError.includes('disk full') || lowerError.includes('no space')) {
    return 'Server storage is full. Please contact support.';
  }

  // Upload specific
  if (lowerError.includes('upload aborted')) {
    return 'Upload was cancelled.';
  }
  if (lowerError.includes('failed to create upload')) {
    return 'Could not start upload. Please try again.';
  }

  // If no match, return a cleaned up version of the original
  // Remove technical prefixes and make it more readable
  let cleaned = error
    .replace(/^Error:\s*/i, '')
    .replace(/^failed to /i, 'Could not ')
    .replace(/\s*\(.*\)$/, ''); // Remove trailing (details)

  // Capitalize first letter
  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

  // Add period if missing
  if (!cleaned.endsWith('.') && !cleaned.endsWith('!') && !cleaned.endsWith('?')) {
    cleaned += '.';
  }

  return cleaned || 'An unexpected error occurred. Please try again.';
}

function sendError(uploadId: string, error: string) {
  const friendlyError = getUserFriendlyError(error);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('upload-error', { uploadId, error: friendlyError });
  }
}

function isTokenExpiredError(statusCode: number, body: string): boolean {
  return statusCode === 401 ||
         statusCode === 403 ||
         body.toLowerCase().includes('token expired') ||
         body.toLowerCase().includes('token invalid') ||
         body.toLowerCase().includes('unauthorized');
}

function sendTokenExpired() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('token-expired');
  }
}

function makeRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: Buffer | fs.ReadStream
): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const protocol = isHttps ? https : http;

    const options: http.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers,
      agent: isHttps ? httpsAgent : httpAgent,
    };

    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body: data
        });
      });
    });

    req.setTimeout(30000, () => req.destroy(new Error('Request timeout')));
    req.on('error', reject);

    if (body instanceof fs.ReadStream) {
      body.pipe(req);
    } else if (body) {
      req.write(body);
      req.end();
    } else {
      req.end();
    }
  });
}

async function createTusUpload(
  endpoint: string,
  filePath: string,
  fileSize: number,
  metadata: Record<string, string>,
  token: string
): Promise<string> {
  // Encode metadata as tus format: key base64value,key2 base64value2
  const metadataStr = Object.entries(metadata)
    .map(([k, v]) => `${k} ${Buffer.from(v).toString('base64')}`)
    .join(',');

  const response = await makeRequest(endpoint, 'POST', {
    'Authorization': `Bearer ${token}`,
    'Tus-Resumable': '1.0.0',
    'Upload-Length': String(fileSize),
    'Upload-Metadata': metadataStr,
    'Content-Type': 'application/offset+octet-stream',
  });

  if (response.statusCode !== 201) {
    if (isTokenExpiredError(response.statusCode, response.body)) {
      sendTokenExpired();
      throw new Error('Token expired');
    }
    throw new Error(`Failed to create upload: ${response.statusCode} ${response.body}`);
  }

  const location = response.headers['location'];
  if (!location) {
    throw new Error('No location header in response');
  }

  // Handle relative URLs
  if (location.startsWith('/')) {
    const parsedEndpoint = new URL(endpoint);
    return `${parsedEndpoint.protocol}//${parsedEndpoint.host}${location}`;
  }

  return location;
}

async function getTusOffset(uploadUrl: string, token: string): Promise<number> {
  const response = await makeRequest(uploadUrl, 'HEAD', {
    'Authorization': `Bearer ${token}`,
    'Tus-Resumable': '1.0.0',
  });

  if (response.statusCode !== 200 && response.statusCode !== 204) {
    if (isTokenExpiredError(response.statusCode, response.body)) {
      sendTokenExpired();
      throw new Error('Token expired');
    }
    throw new Error(`Failed to get offset: ${response.statusCode}`);
  }

  return parseInt(response.headers['upload-offset'] as string, 10) || 0;
}

async function uploadChunk(
  uploadUrl: string,
  filePath: string,
  offset: number,
  chunkSize: number,
  fileSize: number,
  token: string,
  uploadId: string
): Promise<number> {
  const state = activeUploads.get(uploadId);
  if (!state || state.isAborted) {
    throw new Error('Upload aborted');
  }

  const actualChunkSize = Math.min(chunkSize, fileSize - offset);

  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(uploadUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const protocol = isHttps ? https : http;

    const options: http.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'PATCH',
      agent: isHttps ? httpsAgent : httpAgent,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Tus-Resumable': '1.0.0',
        'Upload-Offset': String(offset),
        'Content-Type': 'application/offset+octet-stream',
        'Content-Length': String(actualChunkSize),
      },
    };

    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 204 && res.statusCode !== 200) {
          if (isTokenExpiredError(res.statusCode || 0, data)) {
            sendTokenExpired();
            reject(new Error('Token expired'));
            return;
          }
          reject(new Error(`Upload failed: ${res.statusCode} ${data}`));
          return;
        }

        const newOffset = parseInt(res.headers['upload-offset'] as string, 10);
        resolve(newOffset);
      });
    });

    // Dynamic timeout based on chunk size (minimum 120s)
    const chunkTimeout = Math.max(120000, (actualChunkSize / (100 * 1024)) * 1000);
    req.setTimeout(chunkTimeout, () => req.destroy(new Error('Request timeout')));
    req.on('error', reject);

    // Stream file with sub-chunk progress reporting every 250ms
    const fileStream = fs.createReadStream(filePath, {
      start: offset,
      end: offset + actualChunkSize - 1,
      highWaterMark: 16 * 1024 * 1024 // 16MB read buffer for maximum throughput
    });

    let bytesSentInChunk = 0;
    let lastProgressTime = Date.now();
    const PROGRESS_INTERVAL_MS = 250;

    fileStream.on('data', (data: Buffer) => {
      const canContinue = req.write(data);
      bytesSentInChunk += data.length;
      const now = Date.now();
      if (now - lastProgressTime >= PROGRESS_INTERVAL_MS) {
        sendProgress(uploadId, offset + bytesSentInChunk, fileSize);
        lastProgressTime = now;
      }
      if (!canContinue) {
        fileStream.pause();
        req.once('drain', () => fileStream.resume());
      }
    });
    fileStream.on('end', () => req.end());
    fileStream.on('error', (err) => {
      req.destroy();
      reject(err);
    });
  });
}

async function runUpload(
  uploadId: string,
  filePath: string,
  endpoint: string,
  metadata: Record<string, string>,
  token: string
) {
  const fileSize = fs.statSync(filePath).size;
  const filename = metadata.filename || path.basename(filePath);
  const startTime = Date.now();
  let state = activeUploads.get(uploadId);

  if (!state) {
    state = { offset: 0, isPaused: false, isAborted: false };
    activeUploads.set(uploadId, state);
  }

  // Log upload start
  logUpload({
    timestamp: new Date().toISOString(),
    uploadId,
    filename,
    status: 'started',
    size: fileSize
  });

  startHeartbeat(uploadId);
  let retryCount = 0;

  while (retryCount <= MAX_RETRIES) {
    try {
      // Create upload if we don't have a URL yet
      if (!state.uploadUrl) {
        state.uploadUrl = await createTusUpload(endpoint, filePath, fileSize, metadata, token);
      }

      // Get current offset (for resumption)
      state.offset = await getTusOffset(state.uploadUrl, token);
      sendProgress(uploadId, state.offset, fileSize);

      // Upload chunks
      while (state.offset < fileSize) {
        // Check for pause/abort
        const currentState = activeUploads.get(uploadId);
        if (!currentState || currentState.isAborted) {
          return;
        }
        if (currentState.isPaused) {
          return; // Will be resumed later
        }

        const newOffset = await uploadChunk(
          state.uploadUrl,
          filePath,
          state.offset,
          CHUNK_SIZE,
          fileSize,
          token,
          uploadId
        );

        state.offset = newOffset;
        sendProgress(uploadId, newOffset, fileSize);
        retryCount = 0; // Reset retry count on successful chunk
      }

      // Complete!
      stopHeartbeat(uploadId);
      const duration = Date.now() - startTime;
      logUpload({
        timestamp: new Date().toISOString(),
        uploadId,
        filename,
        status: 'completed',
        size: fileSize,
        duration
      });

      sendComplete(uploadId);
      activeUploads.delete(uploadId);
      return;

    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';

      // Don't retry on token expiration or file system errors
      if (errorMessage.includes('Token expired') ||
          error.code === 'ENOENT' || error.code === 'EACCES') {
        stopHeartbeat(uploadId);
        logUpload({
          timestamp: new Date().toISOString(),
          uploadId,
          filename,
          status: 'failed',
          error: errorMessage
        });
        sendError(uploadId, errorMessage);
        return;
      }

      // Clear upload URL on 404/410 so next retry creates a fresh TUS upload
      if (errorMessage.includes('404') || errorMessage.includes('410')) {
        state.uploadUrl = undefined;
      }

      retryCount++;

      if (retryCount <= MAX_RETRIES) {
        const baseDelay = RETRY_DELAYS[Math.min(retryCount - 1, RETRY_DELAYS.length - 1)];
        const delay = baseDelay + Math.random() * baseDelay * 0.5; // Jitter to prevent thundering herd
        logUpload({
          timestamp: new Date().toISOString(),
          uploadId,
          filename,
          status: 'retrying',
          error: `${errorMessage} (attempt ${retryCount}/${MAX_RETRIES})`
        });
        console.log(`Retrying upload ${filename} in ${Math.round(delay)}ms (attempt ${retryCount}/${MAX_RETRIES})`);
        await sleep(delay);
      } else {
        // All retries exhausted
        stopHeartbeat(uploadId);
        logUpload({
          timestamp: new Date().toISOString(),
          uploadId,
          filename,
          status: 'failed',
          error: errorMessage
        });
        console.error('Upload error after max retries:', error);
        sendError(uploadId, errorMessage);
        return;
      }
    }
  }
}

// ============================================
// PARALLEL UPLOAD IMPLEMENTATION
// Splits large files into N parts, uploads each as a separate tus upload concurrently,
// server concatenates them when all parts arrive.
// ============================================

interface ParallelUploadTracker {
  uploadId: string;
  totalParts: number;
  completedParts: number;
  failedParts: number;
  partBytesUploaded: Map<number, number>;
  totalSize: number;
  isAborted: boolean;
  isPaused: boolean;
}

const parallelTrackers: Map<string, ParallelUploadTracker> = new Map();

function sendParallelProgress(tracker: ParallelUploadTracker) {
  let totalUploaded = 0;
  for (const bytes of tracker.partBytesUploaded.values()) {
    totalUploaded += bytes;
  }
  sendProgress(tracker.uploadId, totalUploaded, tracker.totalSize);
}

async function runParallelUpload(
  uploadId: string,
  filePath: string,
  endpoint: string,
  metadata: Record<string, string>,
  token: string
) {
  const fileSize = fs.statSync(filePath).size;
  const filename = metadata.filename || path.basename(filePath);
  const startTime = Date.now();
  const numParts = PARALLEL_STREAMS;
  const partSize = Math.ceil(fileSize / numParts);
  const groupId = `parallel-${uploadId}-${Date.now()}`;

  logUpload({
    timestamp: new Date().toISOString(),
    uploadId,
    filename,
    status: 'started',
    size: fileSize
  });

  console.log(`[Parallel Upload] Starting ${numParts}-stream upload for ${filename} (${(fileSize / 1024 / 1024).toFixed(0)}MB)`);

  // Create tracker
  const tracker: ParallelUploadTracker = {
    uploadId,
    totalParts: numParts,
    completedParts: 0,
    failedParts: 0,
    partBytesUploaded: new Map(),
    totalSize: fileSize,
    isAborted: false,
    isPaused: false,
  };
  parallelTrackers.set(uploadId, tracker);

  // Also register in activeUploads for pause/abort support
  activeUploads.set(uploadId, { offset: 0, isPaused: false, isAborted: false });

  startHeartbeat(uploadId);

  // Upload each part concurrently
  const partPromises: Promise<boolean>[] = [];

  for (let i = 0; i < numParts; i++) {
    const partStart = i * partSize;
    const partEnd = Math.min(partStart + partSize, fileSize);
    const actualPartSize = partEnd - partStart;

    tracker.partBytesUploaded.set(i, 0);

    const partPromise = uploadPart(
      endpoint, filePath, token,
      groupId, i, numParts, actualPartSize, partStart, partEnd,
      metadata, tracker
    );
    partPromises.push(partPromise);
  }

  const results = await Promise.all(partPromises);
  stopHeartbeat(uploadId);

  // Check if aborted
  const state = activeUploads.get(uploadId);
  if (state?.isAborted || tracker.isAborted) {
    activeUploads.delete(uploadId);
    parallelTrackers.delete(uploadId);
    return;
  }

  // Check if all parts succeeded
  const allSucceeded = results.every(r => r === true);

  if (allSucceeded) {
    const duration = Date.now() - startTime;
    const speedMBs = (fileSize / 1024 / 1024) / (duration / 1000);
    logUpload({
      timestamp: new Date().toISOString(),
      uploadId,
      filename,
      status: 'completed',
      size: fileSize,
      duration
    });
    console.log(`[Parallel Upload] Completed ${filename} in ${(duration / 1000).toFixed(1)}s (${speedMBs.toFixed(1)} MB/s)`);
    sendComplete(uploadId);
  } else {
    logUpload({
      timestamp: new Date().toISOString(),
      uploadId,
      filename,
      status: 'failed',
      error: `${tracker.failedParts} of ${numParts} parts failed`
    });
    sendError(uploadId, `Upload failed: ${tracker.failedParts} of ${numParts} parts could not be uploaded`);
  }

  activeUploads.delete(uploadId);
  parallelTrackers.delete(uploadId);
}

async function uploadPart(
  endpoint: string,
  filePath: string,
  token: string,
  groupId: string,
  partIndex: number,
  totalParts: number,
  partSize: number,
  partStart: number,
  partEnd: number,
  originalMetadata: Record<string, string>,
  tracker: ParallelUploadTracker
): Promise<boolean> {
  // Create a tus upload for this part with group metadata
  const partMetadata: Record<string, string> = {
    ...originalMetadata,
    groupId,
    partIndex: String(partIndex),
    totalParts: String(totalParts),
  };

  const metadataStr = Object.entries(partMetadata)
    .map(([k, v]) => `${k} ${Buffer.from(v).toString('base64')}`)
    .join(',');

  let retryCount = 0;
  let uploadUrl: string | undefined;
  let offset = 0;

  while (retryCount <= MAX_RETRIES) {
    try {
      // Check abort/pause
      const state = activeUploads.get(tracker.uploadId);
      if (!state || state.isAborted || tracker.isAborted) return false;
      if (state.isPaused) {
        await sleep(1000);
        continue;
      }

      // Create the partial tus upload if needed
      if (!uploadUrl) {
        const response = await makeRequest(endpoint, 'POST', {
          'Authorization': `Bearer ${token}`,
          'Tus-Resumable': '1.0.0',
          'Upload-Length': String(partSize),
          'Upload-Metadata': metadataStr,
          'Content-Type': 'application/offset+octet-stream',
        });

        if (response.statusCode !== 201) {
          if (isTokenExpiredError(response.statusCode, response.body)) {
            sendTokenExpired();
            return false;
          }
          throw new Error(`Failed to create part upload: ${response.statusCode}`);
        }

        const location = response.headers['location'];
        if (!location) throw new Error('No location header');

        if (location.startsWith('/')) {
          const parsedEndpoint = new URL(endpoint);
          uploadUrl = `${parsedEndpoint.protocol}//${parsedEndpoint.host}${location}`;
        } else {
          uploadUrl = location;
        }
      }

      // Get current offset for resumption
      const headResponse = await makeRequest(uploadUrl, 'HEAD', {
        'Authorization': `Bearer ${token}`,
        'Tus-Resumable': '1.0.0',
      });

      if (headResponse.statusCode === 200 || headResponse.statusCode === 204) {
        offset = parseInt(headResponse.headers['upload-offset'] as string, 10) || 0;
      }

      // Upload the part data in chunks
      while (offset < partSize) {
        const state = activeUploads.get(tracker.uploadId);
        if (!state || state.isAborted || tracker.isAborted) return false;

        const chunkSize = Math.min(CHUNK_SIZE, partSize - offset);
        const fileOffset = partStart + offset; // Offset within the actual file

        const newOffset = await uploadPartChunk(
          uploadUrl, filePath, fileOffset, offset, chunkSize, partSize,
          token, tracker, partIndex
        );

        offset = newOffset;
        retryCount = 0;
      }

      return true; // Part complete

    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';

      if (errorMessage.includes('Token expired') ||
          error.code === 'ENOENT' || error.code === 'EACCES') {
        tracker.failedParts++;
        return false;
      }

      // Only reset URL on 410 Gone (server explicitly deleted the upload)
      // 404 during reconnection is likely transient — keep URL for resume
      if (errorMessage.includes('410')) {
        uploadUrl = undefined;
      }

      retryCount++;
      if (retryCount <= MAX_RETRIES) {
        const baseDelay = RETRY_DELAYS[Math.min(retryCount - 1, RETRY_DELAYS.length - 1)];
        const delay = baseDelay + Math.random() * baseDelay * 0.5;
        console.log(`[Part ${partIndex}] Retrying in ${Math.round(delay)}ms (attempt ${retryCount}/${MAX_RETRIES})`);
        await sleep(delay);
      } else {
        tracker.failedParts++;
        return false;
      }
    }
  }

  tracker.failedParts++;
  return false;
}

function uploadPartChunk(
  uploadUrl: string,
  filePath: string,
  fileOffset: number,
  tusOffset: number,
  chunkSize: number,
  partSize: number,
  token: string,
  tracker: ParallelUploadTracker,
  partIndex: number
): Promise<number> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(uploadUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const protocol = isHttps ? https : http;

    const options: http.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'PATCH',
      agent: isHttps ? httpsAgent : httpAgent,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Tus-Resumable': '1.0.0',
        'Upload-Offset': String(tusOffset),
        'Content-Type': 'application/offset+octet-stream',
        'Content-Length': String(chunkSize),
      },
    };

    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 204 && res.statusCode !== 200) {
          if (isTokenExpiredError(res.statusCode || 0, data)) {
            sendTokenExpired();
            reject(new Error('Token expired'));
            return;
          }
          reject(new Error(`Part upload failed: ${res.statusCode} ${data}`));
          return;
        }
        const newOffset = parseInt(res.headers['upload-offset'] as string, 10);
        resolve(newOffset);
      });
    });

    const chunkTimeout = Math.max(120000, (chunkSize / (100 * 1024)) * 1000);
    req.setTimeout(chunkTimeout, () => req.destroy(new Error('Request timeout')));
    req.on('error', reject);

    // Stream from file at the correct offset
    const fileStream = fs.createReadStream(filePath, {
      start: fileOffset,
      end: fileOffset + chunkSize - 1,
      highWaterMark: 16 * 1024 * 1024
    });

    let bytesSentInChunk = 0;
    let lastProgressTime = Date.now();
    const PROGRESS_INTERVAL_MS = 200;

    fileStream.on('data', (data: Buffer) => {
      const canContinue = req.write(data);
      bytesSentInChunk += data.length;

      // Update tracker for aggregate progress (never decrease — prevents jumps on retry)
      const newVal = tusOffset + bytesSentInChunk;
      const prevVal = tracker.partBytesUploaded.get(partIndex) || 0;
      if (newVal > prevVal) {
        tracker.partBytesUploaded.set(partIndex, newVal);
      }

      const now = Date.now();
      if (now - lastProgressTime >= PROGRESS_INTERVAL_MS) {
        sendParallelProgress(tracker);
        lastProgressTime = now;
      }

      if (!canContinue) {
        fileStream.pause();
        req.once('drain', () => fileStream.resume());
      }
    });
    fileStream.on('end', () => req.end());
    fileStream.on('error', (err) => {
      req.destroy();
      reject(err);
    });
  });
}

// IPC handlers for upload control
ipcMain.handle('start-upload', async (_, params: {
  uploadId: string;
  filePath: string;
  endpoint: string;
  metadata: Record<string, string>;
  token: string;
}) => {
  const { uploadId, filePath, endpoint, metadata, token } = params;
  const fileSize = fs.statSync(filePath).size;

  // Use parallel upload for large files, single stream for small ones
  const uploadFn = fileSize >= PARALLEL_THRESHOLD
    ? runParallelUpload
    : runUpload;

  uploadFn(uploadId, filePath, endpoint, metadata, token).catch(err => {
    console.error('Upload failed:', err);
    sendError(uploadId, err.message);
  });

  return { success: true };
});

ipcMain.handle('pause-upload', async (_, uploadId: string) => {
  const state = activeUploads.get(uploadId);
  if (state) {
    state.isPaused = true;
  }
  return { success: true };
});

ipcMain.handle('resume-upload', async (_, params: {
  uploadId: string;
  filePath: string;
  endpoint: string;
  metadata: Record<string, string>;
  token: string;
}) => {
  const { uploadId, filePath, endpoint, metadata, token } = params;
  const state = activeUploads.get(uploadId);

  if (state) {
    state.isPaused = false;
    runUpload(uploadId, filePath, endpoint, metadata, token).catch(err => {
      sendError(uploadId, err.message);
    });
  }

  return { success: true };
});

ipcMain.handle('abort-upload', async (_, uploadId: string) => {
  const state = activeUploads.get(uploadId);
  if (state) {
    state.isAborted = true;
    activeUploads.delete(uploadId);
  }
  return { success: true };
});

// Get upload logs (especially failed uploads)
ipcMain.handle('get-upload-logs', async () => {
  return {
    logs: uploadLogs,
    logPath: path.join(app.getPath('userData'), 'upload-log.json'),
    failedUploads: uploadLogs.filter(l => l.status === 'failed')
  };
});

// Open logs folder
ipcMain.handle('open-logs-folder', async () => {
  const logPath = path.join(app.getPath('userData'), 'upload-log.json');
  shell.showItemInFolder(logPath);
});

// Sleep/wake handling - pause uploads on suspend, resume after wake
app.whenReady().then(() => {
  powerMonitor.on('suspend', () => {
    console.log('System suspending - pausing active uploads');
    for (const [uploadId, state] of activeUploads) {
      if (!state.isPaused && !state.isAborted) {
        state.isPaused = true;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('upload-paused-by-system', { uploadId });
        }
      }
    }
  });

  powerMonitor.on('resume', () => {
    console.log('System resumed - uploads will resume via renderer');
    // Renderer handles resume via network monitor
  });
});

// Send email notification via backend API (Postmark key stored on server)
const API_BASE_URL = 'https://upload.turbo.net.au';

ipcMain.handle('send-completion-email', async (_, params: {
  projectName: string;
  crewName: string;
  batchNumber?: number;
  fileCount: number;
  totalSize: string;
  fileNames: string[];
}) => {
  const { projectName, crewName, batchNumber, fileCount, totalSize, fileNames } = params;

  try {
    const postData = JSON.stringify({
      projectName,
      crewName,
      batchNumber,
      fileCount,
      totalSize,
      fileNames
    });

    const response = await makeRequest(`${API_BASE_URL}/api/notification/upload-complete`, 'POST', {
      'Content-Type': 'application/json'
    }, Buffer.from(postData));

    console.log('Email notification sent:', response.statusCode, response.body);
    return { success: response.statusCode === 200, response: response.body };
  } catch (error: any) {
    console.error('Failed to send email notification:', error);
    return { success: false, error: error.message };
  }
});
