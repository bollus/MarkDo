const { app, BrowserWindow, dialog, globalShortcut, ipcMain, protocol, screen } = require('electron');
const { execFile } = require('child_process');
const fs = require('fs/promises');
const fsSync = require('fs');
const os = require('os');
const path = require('path');

const APP_DATA_DIR = path.join(app.getPath('appData'), 'MarkDo');
const LOG_FILE = path.join(APP_DATA_DIR, 'markdo.log');
fsSync.mkdirSync(APP_DATA_DIR, { recursive: true });
app.setPath('userData', APP_DATA_DIR);
app.setPath('cache', path.join(APP_DATA_DIR, 'Cache'));
app.commandLine.appendSwitch('disk-cache-dir', path.join(APP_DATA_DIR, 'ChromiumCache'));
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

function log(message, error = null) {
  const detail = error ? `\n${error.stack || error.message || String(error)}` : '';
  const line = `[${new Date().toISOString()}] ${message}${detail}\n`;
  try {
    fsSync.appendFileSync(LOG_FILE, line, 'utf8');
  } catch {
    // Logging must never stop app startup.
  }
  if (error) console.error(message, error);
  else console.log(message);
}

process.on('uncaughtException', (error) => log('uncaughtException', error));
process.on('unhandledRejection', (error) => log('unhandledRejection', error));

const EXPANDED_SIZE = { width: 390, height: 680 };
const SIDE_STRIP_SIZE = { width: 42, height: 168 };
const HORIZONTAL_STRIP_SIZE = { width: 168, height: 42 };
const SNAP_DISTANCE = 24;
const EDGE_GLOW_DISTANCE = 88;
const ANIMATION_MS = 120;
const PANEL_SLIDE_MS = 135;
const STRIP_SLIDE_MS = 100;
const ANIMATION_FRAME_MS = 16;

let mainWindow;
let quickAddWindow;
let deadlineWindow;
const noteWindows = new Map();
let collapsed = false;
let collapsedEdge = 'right';
let lastExpandedBounds = null;
let isAdjustingBounds = false;
let animationTimer = null;
let isUserDragging = false;
let visualTransition = null;
let visualTransitionToken = 0;
let ocrShortcut = 'Alt+Shift+S';
let quickAddShortcut = 'CommandOrControl+Shift+Space';
let ocrRunning = false;
let ocrSelectionWindow = null;
let pendingDeadlinePayload = null;
let screenshotModule = null;
let sharpModule = null;
let isAppQuitting = false;

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  log('second instance detected, quitting');
  app.quit();
  process.exit(0);
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'markdo',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true
    }
  }
]);

function emitOcrStatus(message) {
  mainWindow?.webContents.send('ocr:status', message);
}

function emitShortcutStatus(message) {
  mainWindow?.webContents.send('shortcut:status', message);
}

function shortcutFailureParts(label, shortcut, error = null) {
  const reason = error
    ? `原因：${error.message || String(error)}`
    : '原因：这个快捷键可能已被其他软件或系统占用，或当前系统不允许使用这个组合键。';
  return {
    message: `${label}快捷键注册失败：${shortcut}`,
    detail: `${reason}\n\n请在设置里重新设置。`
  };
}

function shortcutFailureMessage(label, shortcut, error = null) {
  const parts = shortcutFailureParts(label, shortcut, error);
  return `${parts.message}。${parts.detail.replace(/\n+/g, ' ')}`;
}

function showShortcutFailureDialog(label, shortcut, error = null) {
  const { message, detail } = shortcutFailureParts(label, shortcut, error);
  const parent = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined;
  dialog.showMessageBox(parent, {
    type: 'warning',
    title: '快捷键注册失败',
    message,
    detail,
    buttons: ['去设置里修改', '知道了'],
    defaultId: 0,
    cancelId: 1,
    noLink: true
  }).then((result) => {
    if (result.response !== 0 || !mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (collapsed) expandWindow();
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('settings:open');
  }).catch((dialogError) => log('show shortcut failure dialog failed', dialogError));
}

function closeAuxiliaryWindows() {
  for (const noteWindow of noteWindows.values()) {
    if (!noteWindow.isDestroyed()) noteWindow.close();
  }
  noteWindows.clear();
  if (quickAddWindow && !quickAddWindow.isDestroyed()) quickAddWindow.close();
  if (deadlineWindow && !deadlineWindow.isDestroyed()) deadlineWindow.close();
  if (ocrSelectionWindow && !ocrSelectionWindow.isDestroyed()) ocrSelectionWindow.close();
}

async function confirmAndQuit() {
  const parent = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined;
  const result = await dialog.showMessageBox(parent, {
    type: 'warning',
    title: '退出 MarkDo',
    message: '确定要退出 MarkDo 吗？',
    detail: '退出后，桌面待办窗口、快速添加和 OCR 快捷键都会停止工作。',
    buttons: ['退出', '取消'],
    defaultId: 1,
    cancelId: 1,
    noLink: true
  });
  if (result.response !== 0) return false;
  isAppQuitting = true;
  closeAuxiliaryWindows();
  mainWindow?.close();
  app.quit();
  return true;
}

function quitNow() {
  log('quitNow requested');
  isAppQuitting = true;
  closeAuxiliaryWindows();
  mainWindow?.close();
  app.quit();
}

function getScreenshotModule() {
  if (!screenshotModule) screenshotModule = require('screenshot-desktop');
  return screenshotModule;
}

function getSharpModule() {
  if (!sharpModule) sharpModule = require('sharp');
  return sharpModule;
}

function beginVisualTransition(type) {
  visualTransition = type;
  visualTransitionToken += 1;
  return visualTransitionToken;
}

function isCurrentVisualTransition(token, type) {
  return visualTransitionToken === token && visualTransition === type;
}

function finishVisualTransition(token) {
  if (visualTransitionToken === token) visualTransition = null;
}

function rendererUrl(page = 'index.html') {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) return `${devServerUrl}/${page}`;
  return null;
}

function rendererFile(page = 'index.html') {
  if (app.isPackaged) return path.join(process.resourcesPath, 'dist', page);
  return path.join(__dirname, 'dist', page);
}

function rendererBaseDir() {
  if (app.isPackaged) return path.join(process.resourcesPath, 'dist');
  return path.join(__dirname, 'dist');
}

function registerRendererProtocol() {
  const ok = protocol.registerFileProtocol('markdo', (request, callback) => {
    const url = new URL(request.url);
    const baseDir = path.normalize(rendererBaseDir());
    let requestedPath = decodeURIComponent(url.pathname || '/index.html');
    if (requestedPath === '/') requestedPath = '/index.html';
    requestedPath = requestedPath.replace(/^\/+/, '');

    const filePath = path.normalize(path.join(baseDir, requestedPath));
    const baseWithSep = `${baseDir}${path.sep}`;
    if (filePath !== baseDir && !filePath.startsWith(baseWithSep)) {
      callback({ error: -10 });
      return;
    }

    if (!fsSync.existsSync(filePath)) {
      log(`renderer protocol missing file: ${filePath}`);
      callback({ error: -6 });
      return;
    }

    callback({ path: filePath });
  });
  log(`registerRendererProtocol ok=${ok}`);
}

function iconPath() {
  if (app.isPackaged) return path.join(process.resourcesPath, 'icon.ico');
  return path.join(__dirname, 'build', 'icon.ico');
}

function loadRenderer(window, page = 'index.html', query = null) {
  const devUrl = rendererUrl(page);
  if (devUrl) {
    const url = new URL(devUrl);
    if (query) {
      Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
    }
    window.loadURL(url.toString()).catch((error) => log(`loadURL failed: ${url.toString()}`, error));
  } else {
    const file = rendererFile(page);
    const url = new URL(`markdo://renderer/${page}`);
    if (query) {
      Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
    }
    log(`loadRenderer file=${file} exists=${fsSync.existsSync(file)} url=${url.toString()}`);
    window.loadURL(url.toString()).catch((error) => log(`loadRenderer failed: ${url.toString()}`, error));
  }
}

function createMainWindow() {
  log(`createMainWindow packaged=${app.isPackaged} appPath=${app.getAppPath()} resourcesPath=${process.resourcesPath}`);
  const display = screen.getPrimaryDisplay();
  const { workArea } = display;

  mainWindow = new BrowserWindow({
    width: EXPANDED_SIZE.width,
    height: EXPANDED_SIZE.height,
    x: workArea.x + workArea.width - EXPANDED_SIZE.width - 28,
    y: workArea.y + 72,
    minWidth: 330,
    minHeight: 440,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: true,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    icon: iconPath(),
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  if (typeof mainWindow.setBackgroundMaterial === 'function') {
    mainWindow.setBackgroundMaterial('none');
  }
  loadRenderer(mainWindow, 'index.html');
  mainWindow.once('ready-to-show', () => {
    log('mainWindow ready-to-show');
    mainWindow.center();
    mainWindow.show();
    mainWindow.focus();
  });
  mainWindow.webContents.once('did-finish-load', () => {
    log('mainWindow did-finish-load');
    mainWindow.center();
    mainWindow.show();
    mainWindow.moveTop();
    mainWindow.focus();
  });

  mainWindow.on('moved', normalizeWindowPlacement);
  mainWindow.on('resized', () => {
    if (!collapsed) lastExpandedBounds = mainWindow.getBounds();
  });
  mainWindow.on('closed', () => {
    log('mainWindow closed');
    mainWindow = null;
    if (!isAppQuitting) {
      isAppQuitting = true;
      closeAuxiliaryWindows();
      app.quit();
    }
  });
}

function createQuickAddWindow() {
  if (quickAddWindow && !quickAddWindow.isDestroyed()) return quickAddWindow;
  quickAddWindow = new BrowserWindow({
    width: 560,
    height: 390,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: true,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    icon: iconPath(),
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  quickAddWindow.setAlwaysOnTop(true, 'screen-saver');
  if (typeof quickAddWindow.setBackgroundMaterial === 'function') {
    quickAddWindow.setBackgroundMaterial('none');
  }
  loadRenderer(quickAddWindow, 'quick.html');
  quickAddWindow.on('blur', () => {
    if (quickAddWindow && !quickAddWindow.isDestroyed()) quickAddWindow.hide();
  });
  quickAddWindow.on('closed', () => {
    quickAddWindow = null;
  });
  return quickAddWindow;
}

function createDeadlineWindow() {
  if (deadlineWindow && !deadlineWindow.isDestroyed()) return deadlineWindow;
  deadlineWindow = new BrowserWindow({
    width: 410,
    height: 340,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    icon: iconPath(),
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  deadlineWindow.setAlwaysOnTop(true, 'screen-saver');
  if (typeof deadlineWindow.setBackgroundMaterial === 'function') {
    deadlineWindow.setBackgroundMaterial('none');
  }
  loadRenderer(deadlineWindow, 'deadline.html');
  deadlineWindow.on('blur', () => {
    if (deadlineWindow && !deadlineWindow.isDestroyed()) deadlineWindow.hide();
  });
  deadlineWindow.on('closed', () => {
    deadlineWindow = null;
  });
  return deadlineWindow;
}

function openDeadlineWindow(payload) {
  pendingDeadlinePayload = payload;
  const targetWindow = createDeadlineWindow();
  const { anchor } = payload;
  const { workArea } = screen.getDisplayNearestPoint({ x: Math.round(anchor.right), y: Math.round(anchor.bottom) });
  const bounds = targetWindow.getBounds();
  let x = Math.round(anchor.right - bounds.width);
  let y = Math.round(anchor.bottom + 8);

  if (x < workArea.x + 8) x = workArea.x + 8;
  if (x + bounds.width > workArea.x + workArea.width - 8) x = workArea.x + workArea.width - bounds.width - 8;
  if (y + bounds.height > workArea.y + workArea.height - 8) y = Math.round(anchor.top - bounds.height - 8);
  if (y < workArea.y + 8) y = workArea.y + 8;

  targetWindow.setPosition(x, y, false);
  const show = () => {
    targetWindow.show();
    targetWindow.moveTop();
    targetWindow.focus();
    targetWindow.webContents.send('deadline:init', {
      id: pendingDeadlinePayload.id,
      deadline: pendingDeadlinePayload.deadline
    });
  };
  if (targetWindow.webContents.isLoading()) {
    targetWindow.webContents.once('did-finish-load', () => {
      targetWindow.webContents.executeJavaScript('document.fonts ? document.fonts.ready.then(() => true) : true').catch(() => true).finally(show);
    });
  } else {
    show();
  }
}

function openQuickAddWindow() {
  const targetWindow = createQuickAddWindow();
  const baseBounds = mainWindow && !mainWindow.isDestroyed() ? mainWindow.getBounds() : { ...screen.getCursorScreenPoint(), width: 1, height: 1 };
  const { workArea } = screen.getDisplayMatching(baseBounds);
  const bounds = targetWindow.getBounds();
  const x = Math.round(workArea.x + (workArea.width - bounds.width) / 2);
  const y = Math.round(workArea.y + (workArea.height - bounds.height) / 2);

  targetWindow.setPosition(x, y, false);
  const show = () => {
    targetWindow.show();
    targetWindow.moveTop();
    targetWindow.focus();
    targetWindow.webContents.send('quickAdd:open');
  };
  if (targetWindow.webContents.isLoading()) {
    targetWindow.webContents.once('did-finish-load', () => {
      targetWindow.webContents.executeJavaScript('document.fonts ? document.fonts.ready.then(() => true) : true').catch(() => true).finally(show);
    });
  } else {
    show();
  }
}

function currentDisplayForWindow() {
  return screen.getDisplayMatching(mainWindow.getBounds());
}

function nearestEdge(bounds, workArea) {
  const distances = [
    { edge: 'left', distance: Math.abs(bounds.x - workArea.x) },
    { edge: 'right', distance: Math.abs(workArea.x + workArea.width - (bounds.x + bounds.width)) },
    { edge: 'top', distance: Math.abs(bounds.y - workArea.y) },
    { edge: 'bottom', distance: Math.abs(workArea.y + workArea.height - (bounds.y + bounds.height)) }
  ];
  return distances.sort((a, b) => a.distance - b.distance)[0];
}

function isOutOfWorkArea(bounds, workArea) {
  return bounds.x < workArea.x
    || bounds.y < workArea.y
    || bounds.x + bounds.width > workArea.x + workArea.width
    || bounds.y + bounds.height > workArea.y + workArea.height;
}

function isSideEdge(edge) {
  return edge === 'left' || edge === 'right';
}

function cursorInsideBounds(bounds) {
  const cursor = screen.getCursorScreenPoint();
  return cursor.x >= bounds.x
    && cursor.x <= bounds.x + bounds.width
    && cursor.y >= bounds.y
    && cursor.y <= bounds.y + bounds.height;
}

function collapsedSizeForEdge(edge) {
  return isSideEdge(edge) ? SIDE_STRIP_SIZE : HORIZONTAL_STRIP_SIZE;
}

function snappedBounds(edge, sourceBounds, workArea, isCollapsed) {
  const maxWidth = Math.max(280, workArea.width - 16);
  const maxHeight = Math.max(280, workArea.height - 16);
  const size = isCollapsed ? collapsedSizeForEdge(edge) : {
    width: Math.min(Math.max(sourceBounds.width, 330), maxWidth),
    height: Math.min(Math.max(sourceBounds.height, 440), maxHeight)
  };

  const centeredX = Math.round(sourceBounds.x + sourceBounds.width / 2 - size.width / 2);
  const centeredY = Math.round(sourceBounds.y + sourceBounds.height / 2 - size.height / 2);
  const clampX = Math.min(Math.max(centeredX, workArea.x), workArea.x + workArea.width - size.width);
  const clampY = Math.min(Math.max(centeredY, workArea.y), workArea.y + workArea.height - size.height);

  if (edge === 'left') return { x: workArea.x, y: clampY, width: size.width, height: size.height };
  if (edge === 'right') return { x: workArea.x + workArea.width - size.width, y: clampY, width: size.width, height: size.height };
  if (edge === 'top') return { x: clampX, y: workArea.y, width: size.width, height: size.height };
  return { x: clampX, y: workArea.y + workArea.height - size.height, width: size.width, height: size.height };
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

function setWindowBounds(bounds, animate = true, onDone = null) {
  isAdjustingBounds = true;
  if (animationTimer) clearTimeout(animationTimer);

  if (!animate) {
    try {
      mainWindow.setBounds(bounds, false);
      isAdjustingBounds = false;
      if (onDone) onDone();
    } catch (error) {
      console.error('setBounds failed:', error);
      isAdjustingBounds = false;
    }
    return;
  }

  const start = mainWindow.getBounds();
  const startTime = Date.now();

  const tick = () => {
    const elapsed = Date.now() - startTime;
    const progress = easeOutCubic(Math.min(1, elapsed / ANIMATION_MS));
    const next = {
      x: Math.round(start.x + (bounds.x - start.x) * progress),
      y: Math.round(start.y + (bounds.y - start.y) * progress),
      width: Math.round(start.width + (bounds.width - start.width) * progress),
      height: Math.round(start.height + (bounds.height - start.height) * progress)
    };
    try {
      mainWindow.setBounds(next, false);
    } catch (error) {
      console.error('setBounds animation failed:', error);
      animationTimer = null;
      isAdjustingBounds = false;
      if (onDone) onDone();
      return;
    }

    if (progress >= 1) {
      animationTimer = null;
      try {
        mainWindow.setBounds(bounds, false);
        isAdjustingBounds = false;
        if (onDone) onDone();
      } catch (error) {
        console.error('final setBounds failed:', error);
        isAdjustingBounds = false;
      }
      return;
    }
    animationTimer = setTimeout(tick, ANIMATION_FRAME_MS);
  };

  tick();
}

function animateWindowPosition(target, onDone = null, duration = ANIMATION_MS) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  isAdjustingBounds = true;
  if (animationTimer) clearTimeout(animationTimer);

  const start = mainWindow.getBounds();
  const startTime = Date.now();

  const tick = () => {
    const elapsed = Date.now() - startTime;
    const progress = easeOutCubic(Math.min(1, elapsed / duration));
    const x = Math.round(start.x + (target.x - start.x) * progress);
    const y = Math.round(start.y + (target.y - start.y) * progress);
    try {
      mainWindow.setPosition(x, y, false);
    } catch (error) {
      console.error('setPosition animation failed:', error);
      animationTimer = null;
      isAdjustingBounds = false;
      if (onDone) onDone();
      return;
    }

    if (progress >= 1) {
      animationTimer = null;
      try {
        mainWindow.setPosition(target.x, target.y, false);
        isAdjustingBounds = false;
        if (onDone) onDone();
      } catch (error) {
        console.error('final setPosition failed:', error);
        isAdjustingBounds = false;
      }
      return;
    }
    animationTimer = setTimeout(tick, ANIMATION_FRAME_MS);
  };

  tick();
}

function offscreenBounds(edge, bounds, workArea) {
  if (edge === 'left') return { ...bounds, x: workArea.x - bounds.width };
  if (edge === 'right') return { ...bounds, x: workArea.x + workArea.width };
  if (edge === 'top') return { ...bounds, y: workArea.y - bounds.height };
  return { ...bounds, y: workArea.y + workArea.height };
}

function execFileAsync(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { encoding: 'utf8', ...options }, (error, stdout, stderr) => {
      if (error) {
        error.stderr = stderr;
        error.stdout = stdout;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function possibleBundledRapidOcrDirs() {
  const dirs = [
    path.join(__dirname, 'vendor', 'ocr', 'RapidOCR-json'),
    path.join(__dirname, 'vendor', 'ocr'),
  ];

  if (process.resourcesPath) {
    dirs.push(
      path.join(process.resourcesPath, 'ocr', 'RapidOCR-json'),
      path.join(process.resourcesPath, 'ocr')
    );
  }

  return dirs;
}

function bundledRapidOcrEngine() {
  for (const dir of possibleBundledRapidOcrDirs()) {
    for (const exeName of ['RapidOCR-json.exe', 'RapidOCR_json.exe']) {
      const exe = path.join(dir, exeName);
      if (fsSync.existsSync(exe)) return { exe, cwd: dir };
    }
  }
  return null;
}

function parseOcrJsonOutput(stdout) {
  const raw = String(stdout || '').trim();
  if (!raw) return '';

  const jsonLine = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .reverse()
    .find((line) => line.startsWith('{') && line.endsWith('}'));

  const parsed = JSON.parse(jsonLine || raw);
  if (parsed.code === 101) return '';
  if (parsed.code !== 100 || !Array.isArray(parsed.data)) {
    throw new Error(`OCR engine returned code ${parsed.code || 'unknown'}`);
  }

  return parsed.data
    .map((item) => String(item?.text || '').trim())
    .filter(Boolean)
    .join('\n');
}

async function recognizeWithBundledRapidOcr(imagePath) {
  const engine = bundledRapidOcrEngine();
  if (!engine) return null;

  const { stdout } = await execFileAsync(engine.exe, [
    `--image_path=${imagePath}`,
    '--ensureAscii=0',
    '--maxSideLen=1920'
  ], {
    cwd: engine.cwd,
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 8
  });

  return parseOcrJsonOutput(stdout).trim();
}

async function recognizeWithPaddleOCR(imageBuffer) {
  const imagePath = path.join(os.tmpdir(), `markdo-ocr-${Date.now()}-${Math.random().toString(16).slice(2)}.png`);
  await fs.writeFile(imagePath, imageBuffer);
  try {
    const bundledText = await recognizeWithBundledRapidOcr(imagePath);
    if (bundledText !== null) return bundledText;
    throw new Error('Bundled RapidOCR-json engine was not found.');
  } catch (error) {
    log('OCR failed', error);
    throw error;
  } finally {
    await fs.unlink(imagePath).catch(() => {});
  }
}

function emitWindowState(isDocked = true) {
  const state = {
    collapsed,
    edge: collapsedEdge,
    docked: isUserDragging && isDocked,
    dragging: isUserDragging
  };
  mainWindow?.webContents.send('window:collapsed', state);
}

function normalizeWindowPlacement(commit = false) {
  if (!mainWindow || isAdjustingBounds || visualTransition) return;
  const bounds = mainWindow.getBounds();
  const { workArea } = currentDisplayForWindow();
  const nearest = nearestEdge(bounds, workArea);
  const shouldDock = nearest.distance <= SNAP_DISTANCE || isOutOfWorkArea(bounds, workArea);
  const shouldGlow = isUserDragging && (nearest.distance <= EDGE_GLOW_DISTANCE || shouldDock);

  collapsedEdge = nearest.edge;

  if (shouldDock && commit) {
    setWindowBounds(snappedBounds(nearest.edge, bounds, workArea, collapsed), true);
    emitWindowState(isUserDragging);
  } else if (!collapsed) {
    emitWindowState(shouldGlow);
  }
  if (!collapsed) lastExpandedBounds = mainWindow.getBounds();
}

function collapseWindow(edge = null) {
  if (!mainWindow || collapsed || visualTransition) return;
  const token = beginVisualTransition('collapse');
  lastExpandedBounds = mainWindow.getBounds();
  const { workArea } = screen.getDisplayMatching(lastExpandedBounds);
  collapsedEdge = edge || nearestEdge(lastExpandedBounds, workArea).edge;
  const stripTarget = snappedBounds(collapsedEdge, lastExpandedBounds, workArea, true);

  mainWindow.webContents.send('window:closePopups');
  if (deadlineWindow && !deadlineWindow.isDestroyed()) deadlineWindow.hide();
  mainWindow.webContents.send('window:collapseVisual', { mode: 'panel-collapse', edge: collapsedEdge });
  setTimeout(() => {
    if (!isCurrentVisualTransition(token, 'collapse')) return;
    collapsed = true;
    mainWindow.setResizable(false);
    mainWindow.setMinimumSize(1, 1);
    setWindowBounds(stripTarget, false);
    emitWindowState(false);
    mainWindow.webContents.send('window:collapseVisual', { mode: 'strip-enter', edge: collapsedEdge });
    setTimeout(() => finishVisualTransition(token), 125);
  }, 145);
}

function expandWindow() {
  if (!mainWindow || !collapsed || isAdjustingBounds || visualTransition) return;
  const token = beginVisualTransition('expand');
  const start = mainWindow.getBounds();
  const { workArea } = screen.getDisplayMatching(start);
  const source = lastExpandedBounds || {
    x: workArea.x + workArea.width - EXPANDED_SIZE.width - 28,
    y: workArea.y + 72,
    ...EXPANDED_SIZE
  };
  const target = snappedBounds(collapsedEdge, source, workArea, false);

  mainWindow.webContents.send('window:collapseVisual', { mode: 'strip-collapse', edge: collapsedEdge });
  setTimeout(() => {
    if (!isCurrentVisualTransition(token, 'expand')) return;
    mainWindow.webContents.send('window:collapseVisual', { mode: 'blank', edge: collapsedEdge });
    setTimeout(() => {
      if (!isCurrentVisualTransition(token, 'expand')) return;
      mainWindow.setMinimumSize(330, 440);
      setWindowBounds(target, false);
      mainWindow.webContents.send('window:collapseVisual', { mode: 'panel-enter', edge: collapsedEdge });
      collapsed = false;
      emitWindowState(false);
      setTimeout(() => {
        if (!isCurrentVisualTransition(token, 'expand')) return;
        const shouldCollapse = !cursorInsideBounds(mainWindow.getBounds());
        finishVisualTransition(token);
        if (shouldCollapse) {
      setTimeout(() => collapseIfDocked(), 55);
        }
      }, 175);
    }, 20);
  }, 115);
}

async function runOcrCapture() {
  log(`runOcrCapture requested hasMain=${Boolean(mainWindow)} running=${ocrRunning}`);
  if (!mainWindow || ocrRunning) return;
  ocrRunning = true;
  try {
    emitOcrStatus('正在准备 OCR...');
    log('OCR loading screenshot module');
    const screenshot = getScreenshotModule();
    log(`OCR screenshot module loaded listDisplays=${typeof screenshot.listDisplays}`);
    log('OCR loading sharp module');
    const sharp = getSharpModule();
    log(`OCR sharp module loaded type=${typeof sharp}`);
    mainWindow.webContents.send('window:closePopups');
    emitOcrStatus('框选 OCR 区域...');
    log('OCR selecting region');
    const selection = await selectOcrRegion();
    log(`OCR selection result=${selection ? JSON.stringify(selection.rect) : 'null'}`);
    if (!selection) {
      emitOcrStatus('已取消 OCR');
      return;
    }
    if (selection.rect.width < 4 || selection.rect.height < 4) {
      emitOcrStatus('未识别到文字');
      return;
    }
    emitOcrStatus('正在截图...');
    log(`OCR capturing screen display=${selection.captureDisplay.id}`);
    const imageBuffer = await screenshot({ format: 'png', screen: selection.captureDisplay.id });
    log(`OCR screenshot captured bytes=${imageBuffer.length}`);
    const croppedBuffer = await sharp(imageBuffer)
      .extract({
        left: selection.rect.x,
        top: selection.rect.y,
        width: selection.rect.width,
        height: selection.rect.height
      })
      .png()
      .toBuffer();
    const ocrBuffer = await sharp(croppedBuffer)
      .resize({
        width: selection.rect.width * 2,
        height: selection.rect.height * 2,
        kernel: sharp.kernel.lanczos3
      })
      .grayscale()
      .normalize()
      .sharpen({ sigma: 1.1, m1: 1.2, m2: 0.45 })
      .png()
      .toBuffer();
    const screenshotDataUrl = `data:image/png;base64,${croppedBuffer.toString('base64')}`;
    emitOcrStatus('正在识别文字...');
    log('OCR recognizing');
    const text = await recognizeWithPaddleOCR(ocrBuffer);
    log(`OCR recognized length=${text.length}`);
    if (!text) {
      emitOcrStatus('未识别到文字');
      return;
    }
    const firstLine = text.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || '截图 OCR 待办';
    const now = new Date().toISOString();
    mainWindow.webContents.send('ocr:todo', {
      id: `ocr-${Date.now()}`,
      title: firstLine.slice(0, 48),
      deadline: null,
      summary: '来自截图 OCR',
      details: text,
      screenshotDataUrl,
      done: false,
      createdAt: now,
      updatedAt: now
    });
    emitOcrStatus('已生成待办');
  } catch (error) {
    log('OCR capture failed', error);
    emitOcrStatus('OCR 失败');
  } finally {
    ocrRunning = false;
  }
}

async function selectOcrRegion() {
  if (ocrSelectionWindow && !ocrSelectionWindow.isDestroyed()) {
    ocrSelectionWindow.close();
    ocrSelectionWindow = null;
  }

  const screenshot = getScreenshotModule();
  const cursor = screen.getCursorScreenPoint();
  const electronDisplay = screen.getDisplayNearestPoint(cursor);
  const captureDisplays = await screenshot.listDisplays();
  const captureDisplay = captureDisplays.find((display) =>
    Math.round(display.left) === Math.round(electronDisplay.bounds.x)
    && Math.round(display.top) === Math.round(electronDisplay.bounds.y)
  ) || captureDisplays[0];
  const bounds = {
    x: captureDisplay.left,
    y: captureDisplay.top,
    width: captureDisplay.width,
    height: captureDisplay.height
  };

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      ipcMain.removeListener('ocr:selection', onSelection);
      ipcMain.removeListener('ocr:selection-cancel', onCancel);
      if (ocrSelectionWindow && !ocrSelectionWindow.isDestroyed()) ocrSelectionWindow.close();
      ocrSelectionWindow = null;
      resolve(value);
    };
    const onSelection = (_event, rect) => {
      const normalized = {
        x: Math.max(0, Math.round(rect.x)),
        y: Math.max(0, Math.round(rect.y)),
        width: Math.min(bounds.width - Math.max(0, Math.round(rect.x)), Math.round(rect.width)),
        height: Math.min(bounds.height - Math.max(0, Math.round(rect.y)), Math.round(rect.height))
      };
      if (normalized.width < 8 || normalized.height < 8) {
        finish(null);
        return;
      }
      finish({ rect: normalized, captureDisplay });
    };
    const onCancel = () => finish(null);
    ipcMain.on('ocr:selection', onSelection);
    ipcMain.on('ocr:selection-cancel', onCancel);

    ocrSelectionWindow = new BrowserWindow({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      backgroundColor: '#00000000',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });
    ocrSelectionWindow.setAlwaysOnTop(true, 'screen-saver');
    ocrSelectionWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(selectionHtml())}`);
    ocrSelectionWindow.once('closed', () => finish(null));
  });
}

function selectionHtml() {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; cursor: crosshair; user-select: none; }
    body { background: rgba(0,0,0,.18); font-family: "Microsoft YaHei UI", sans-serif; }
    #hint { position: fixed; left: 50%; top: 18px; transform: translateX(-50%); color: white; background: rgba(0,0,0,.52); padding: 8px 12px; border-radius: 8px; font-size: 13px; }
    #box { position: fixed; border: 2px solid #60a5fa; background: rgba(96,165,250,.16); box-shadow: 0 0 0 9999px rgba(0,0,0,.28), 0 0 18px rgba(96,165,250,.72); display: none; }
  </style>
</head>
<body>
  <div id="hint">拖拽框选 OCR 区域，Esc 取消</div>
  <div id="box"></div>
  <script>
    const box = document.getElementById('box');
    let start = null;
    let current = null;
    function render() {
      if (!start || !current) return;
      const x = Math.min(start.x, current.x);
      const y = Math.min(start.y, current.y);
      const width = Math.abs(current.x - start.x);
      const height = Math.abs(current.y - start.y);
      box.style.display = 'block';
      box.style.left = x + 'px';
      box.style.top = y + 'px';
      box.style.width = width + 'px';
      box.style.height = height + 'px';
    }
    window.addEventListener('pointerdown', (event) => {
      start = { x: event.clientX, y: event.clientY };
      current = start;
      render();
    });
    window.addEventListener('pointermove', (event) => {
      if (!start) return;
      current = { x: event.clientX, y: event.clientY };
      render();
    });
    window.addEventListener('pointerup', () => {
      if (!start || !current) return window.markdo.cancelOcrSelection();
      const x = Math.min(start.x, current.x);
      const y = Math.min(start.y, current.y);
      const width = Math.abs(current.x - start.x);
      const height = Math.abs(current.y - start.y);
      window.markdo.finishOcrSelection({ x, y, width, height });
    });
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') window.markdo.cancelOcrSelection();
    });
  </script>
</body>
</html>`;
}

function registerOcrShortcut(shortcut = ocrShortcut) {
  const nextShortcut = shortcut || 'Alt+Shift+S';
  const previousShortcut = ocrShortcut;
  try {
    if (nextShortcut === previousShortcut) globalShortcut.unregister(previousShortcut);
    const registered = globalShortcut.register(nextShortcut, runOcrCapture);
    log(`registerOcrShortcut shortcut=${nextShortcut} registered=${registered}`);
    if (!registered) {
      const message = shortcutFailureMessage('OCR', nextShortcut);
      emitShortcutStatus(message);
      emitOcrStatus(message);
      showShortcutFailureDialog('OCR', nextShortcut);
      return false;
    }
    if (nextShortcut !== previousShortcut) globalShortcut.unregister(previousShortcut);
    ocrShortcut = nextShortcut;
    emitOcrStatus(`快捷键已设置：${ocrShortcut}`);
    return registered;
  } catch (error) {
    log('register OCR shortcut failed', error);
    const message = shortcutFailureMessage('OCR', nextShortcut, error);
    emitShortcutStatus(message);
    emitOcrStatus(message);
    showShortcutFailureDialog('OCR', nextShortcut, error);
    return false;
  }
}

function registerQuickAddShortcut(shortcut = quickAddShortcut) {
  const nextShortcut = shortcut || 'CommandOrControl+Shift+Space';
  const previousShortcut = quickAddShortcut;
  try {
    if (nextShortcut === previousShortcut) globalShortcut.unregister(previousShortcut);
    const registered = globalShortcut.register(nextShortcut, openQuickAddWindow);
    log(`registerQuickAddShortcut shortcut=${nextShortcut} registered=${registered}`);
    if (!registered) {
      emitShortcutStatus(shortcutFailureMessage('快速添加', nextShortcut));
      showShortcutFailureDialog('快速添加', nextShortcut);
      return false;
    }
    if (nextShortcut !== previousShortcut) globalShortcut.unregister(previousShortcut);
    quickAddShortcut = nextShortcut;
    return registered;
  } catch (error) {
    log('register quick add shortcut failed', error);
    emitShortcutStatus(shortcutFailureMessage('快速添加', nextShortcut, error));
    showShortcutFailureDialog('快速添加', nextShortcut, error);
    return false;
  }
}

function collapseIfDocked() {
  if (!mainWindow || collapsed || visualTransition) return;
  const bounds = mainWindow.getBounds();
  if (cursorInsideBounds(bounds)) return;

  const { workArea } = currentDisplayForWindow();
  const nearest = nearestEdge(bounds, workArea);
  if (nearest.distance <= 1) collapseWindow(nearest.edge);
}

function getPreloadPath() {
  if (app.isPackaged) return path.join(process.resourcesPath, 'app.asar', 'preload.js');
  return path.join(__dirname, 'preload.js');
}

function createNoteWindow(todo) {
  const existing = noteWindows.get(todo.id);
  if (existing && !existing.isDestroyed()) {
    if (existing.isMinimized()) existing.restore();
    existing.show();
    existing.focus();
    existing.moveTop();
    return;
  }

  const parentBounds = mainWindow.getBounds();
  const { workArea } = screen.getDisplayMatching(parentBounds);
  const width = 390;
  const height = Math.min(460, Math.max(330, Math.floor(workArea.height * 0.56)));
  const rightSideX = parentBounds.x + parentBounds.width + 16;
  const leftSideX = parentBounds.x - width - 16;
  const x = rightSideX + width <= workArea.x + workArea.width
    ? rightSideX
    : Math.max(workArea.x + 16, leftSideX);
  const y = Math.min(
    Math.max(parentBounds.y + 48, workArea.y + 16),
    workArea.y + workArea.height - height - 16
  );
  const noteWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    minWidth: 360,
    minHeight: 320,
    frame: false,
    transparent: true,
    hasShadow: false,
    title: '备注',
    alwaysOnTop: true,
    show: false,
    icon: iconPath(),
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  noteWindow.setAlwaysOnTop(true, 'screen-saver');
  noteWindow.moveTop();
  loadRenderer(noteWindow, 'note.html');
  noteWindow.webContents.once('did-finish-load', async () => {
    await Promise.race([
      noteWindow.webContents.executeJavaScript('document.fonts ? document.fonts.ready.then(() => true) : true').catch(() => true),
      new Promise((resolve) => setTimeout(resolve, 900))
    ]);
    noteWindow.webContents.send('note:init', todo);
    noteWindows.set(todo.id, noteWindow);
    noteWindow.show();
    noteWindow.focus();
    noteWindow.moveTop();
  });
  noteWindow.on('closed', () => {
    if (noteWindows.get(todo.id) === noteWindow) noteWindows.delete(todo.id);
  });
}

function createImageWindow(dataUrl) {
  const parentBounds = mainWindow?.getBounds() || { x: 80, y: 80, width: 390, height: 680 };
  const { workArea } = screen.getDisplayMatching(parentBounds);
  const width = Math.min(920, Math.max(520, Math.floor(workArea.width * 0.58)));
  const height = Math.min(680, Math.max(360, Math.floor(workArea.height * 0.62)));
  const imageWindow = new BrowserWindow({
    width,
    height,
    x: Math.min(Math.max(parentBounds.x + 32, workArea.x + 16), workArea.x + workArea.width - width - 16),
    y: Math.min(Math.max(parentBounds.y + 32, workArea.y + 16), workArea.y + workArea.height - height - 16),
    minWidth: 420,
    minHeight: 300,
    frame: false,
    transparent: true,
    hasShadow: false,
    title: 'OCR 截图',
    alwaysOnTop: true,
    icon: iconPath(),
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  imageWindow.setAlwaysOnTop(true, 'screen-saver');
  imageWindow.moveTop();
  imageWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(imageViewerHtml(dataUrl))}`);
}

function imageViewerHtml(dataUrl) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; font-family: "Microsoft YaHei UI", sans-serif; }
    body { background: transparent; }
    main { width: 100vw; height: 100vh; display: grid; grid-template-rows: 44px 1fr; overflow: hidden; border-radius: 18px; border: 1px solid rgba(120,150,200,.24); background: #fff; color: #111827; }
    @media (prefers-color-scheme: dark) { main { background: #2a2a2a; color: #f5f5f5; border-color: #5a5a5a; } header { border-color: #5a5a5a !important; } button { color: #f5f5f5 !important; } }
    header { -webkit-app-region: drag; display: flex; align-items: center; justify-content: space-between; padding: 0 10px 0 14px; border-bottom: 1px solid rgba(148,163,184,.35); font-size: 14px; font-weight: 700; }
    button { -webkit-app-region: no-drag; border: 0; background: transparent; width: 32px; height: 32px; border-radius: 9px; font-size: 22px; cursor: pointer; color: #475569; }
    button:hover { background: rgba(148,163,184,.18); }
    section { display: grid; place-items: center; min-height: 0; padding: 12px; }
    img { max-width: 100%; max-height: 100%; object-fit: contain; }
  </style>
</head>
<body>
  <main>
    <header><span>OCR 截图原图</span><button onclick="window.markdo.closeCurrent()">×</button></header>
    <section><img src="${dataUrl}" alt="OCR 截图原图" /></section>
  </main>
</body>
</html>`;
}

ipcMain.handle('window:collapse', (_event, edge) => collapseWindow(edge));
ipcMain.handle('window:expand', expandWindow);
ipcMain.handle('window:collapseIfDocked', collapseIfDocked);
ipcMain.handle('window:dragStart', () => {
  isUserDragging = true;
  normalizeWindowPlacement(false);
});
ipcMain.handle('window:dragEnd', () => {
  isUserDragging = false;
  normalizeWindowPlacement(true);
  emitWindowState(false);
});
ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:close', () => {
  mainWindow?.close();
});
ipcMain.handle('app:quitConfirm', confirmAndQuit);
ipcMain.handle('app:quitNow', () => quitNow());
ipcMain.handle('window:minimizeCurrent', (event) => BrowserWindow.fromWebContents(event.sender)?.minimize());
ipcMain.handle('window:closeCurrent', (event) => BrowserWindow.fromWebContents(event.sender)?.close());
ipcMain.handle('window:hideCurrent', (event) => BrowserWindow.fromWebContents(event.sender)?.hide());
ipcMain.handle('window:setAlwaysOnTop', (_event, value) => {
  mainWindow?.setAlwaysOnTop(Boolean(value), 'screen-saver');
});
ipcMain.handle('ocr:setShortcut', (_event, shortcut) => registerOcrShortcut(shortcut));
ipcMain.handle('quickAdd:setShortcut', (_event, shortcut) => registerQuickAddShortcut(shortcut));
ipcMain.handle('ocr:capture', runOcrCapture);
ipcMain.handle('note:open', (_event, todo) => createNoteWindow(todo));
ipcMain.handle('image:open', (_event, dataUrl) => createImageWindow(dataUrl));
ipcMain.handle('deadline:open', (_event, payload) => openDeadlineWindow(payload));
ipcMain.on('quickAdd:createTodo', (event, todo) => {
  mainWindow?.webContents.send('quickAdd:todo', todo);
  BrowserWindow.fromWebContents(event.sender)?.hide();
});
ipcMain.on('deadline:save', (event, payload) => {
  mainWindow?.webContents.send('deadline:updated', payload);
  BrowserWindow.fromWebContents(event.sender)?.hide();
});
ipcMain.on('note:save', (event, payload) => {
  mainWindow?.webContents.send('note:updated', payload);
  BrowserWindow.fromWebContents(event.sender)?.close();
});

app.whenReady().then(() => {
  isAppQuitting = false;
  log('app ready');
  registerRendererProtocol();
  createMainWindow();
  registerOcrShortcut();
  registerQuickAddShortcut();
}).catch((error) => log('app.whenReady failed', error));

app.on('second-instance', () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    if (app.isReady() && !isAppQuitting) createMainWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  isAppQuitting = true;
  globalShortcut.unregisterAll();
});
