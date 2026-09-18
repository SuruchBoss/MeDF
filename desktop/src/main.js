'use strict';

/**
 * MeDF desktop shell.
 *
 * The app ships the Next.js `standalone` server bundle and runs it as a child
 * process bound to 127.0.0.1 on a free port, then points a BrowserWindow at
 * it. That keeps one codebase for web and desktop, and the whole thing works
 * offline: documents, members and uploads live in the per-user application
 * data folder.
 */

const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const {
  BrowserWindow,
  Menu,
  app,
  session,
  dialog,
  shell,
  ipcMain,
} = require('electron');

const IS_DEV = !app.isPackaged;
const DEV_URL = process.env.MEDF_DEV_URL ?? '';
const HOST = '127.0.0.1';

/** Where members, documents and uploads are stored on this machine. */
const dataDir = path.join(app.getPath('userData'), 'data');

let serverProcess = null;
let serverUrl = null;
let mainWindow = null;
const serverLog = [];

const HEADLESS = Boolean(process.env.MEDF_SELFTEST_DIR);

/** Reports a fatal startup problem; never blocks when running headless. */
function reportFatal(title, detail) {
  const message = `${title}\n\n${detail}`;
  if (HEADLESS) {
    console.error(`[medf] ${message}`);
    app.isQuiting = true;
    stopServer();
    app.exit(1);
    return;
  }
  dialog.showErrorBox(title, message);
}

function recordLog(chunk) {
  serverLog.push(String(chunk));
  if (serverLog.length > 200) serverLog.splice(0, serverLog.length - 200);
}

/** Resolves the standalone server entry point inside the packaged app. */
function resolveServerEntry() {
  const candidates = [
    // Packaged: copied into `resources/server` by scripts/after-pack.cjs.
    path.join(process.resourcesPath ?? '', 'server', 'apps', 'web', 'server.js'),
    // Local `npm run desktop:build` output.
    path.join(__dirname, '..', 'resources', 'app', 'apps', 'web', 'server.js'),
    // Straight from the web workspace build.
    path.join(__dirname, '..', '..', 'apps', 'web', '.next', 'standalone', 'apps', 'web', 'server.js'),
  ];
  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) ?? null;
}

/**
 * A stable per-installation secret for signing session cookies, so members
 * stay signed in across restarts and upgrades.
 */
function loadSessionSecret() {
  const file = path.join(app.getPath('userData'), 'session.key');
  try {
    const existing = fs.readFileSync(file, 'utf8').trim();
    if (existing.length >= 32) return existing;
  } catch {
    /* first run */
  }
  const secret = crypto.randomBytes(48).toString('base64url');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${secret}\n`, { mode: 0o600 });
  return secret;
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on('error', reject);
    probe.listen(0, HOST, () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

function waitForServer(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (Date.now() > deadline) {
        reject(new Error('เซิร์ฟเวอร์ภายในเครื่องไม่ตอบสนอง'));
        return;
      }
      const request = net.connect({ host: HOST, port: url.port }, () => {
        request.end();
        resolve();
      });
      request.on('error', () => {
        request.destroy();
        setTimeout(attempt, 300);
      });
    };
    attempt();
  });
}

async function startServer() {
  if (DEV_URL) {
    serverUrl = new URL(DEV_URL);
    await waitForServer(serverUrl);
    return;
  }

  const entry = resolveServerEntry();
  if (!entry) {
    throw new Error(
      'ไม่พบไฟล์เซิร์ฟเวอร์ของแอป (apps/web/server.js) — กรุณาสร้างแพ็กเกจด้วยคำสั่ง npm run desktop:build',
    );
  }

  const port = await findFreePort();
  serverUrl = new URL(`http://${HOST}:${port}`);
  fs.mkdirSync(dataDir, { recursive: true });

  serverProcess = spawn(process.execPath, [entry], {
    cwd: path.dirname(entry),
    env: {
      ...process.env,
      // Run the bundled Electron binary as plain Node for the server process.
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      PORT: String(port),
      HOSTNAME: HOST,
      MEDF_DATA_DIR: dataDir,
      MEDF_SESSION_SECRET: loadSessionSecret(),
      MEDF_APP_URL: serverUrl.origin,
      // No payment provider on the desktop: plans switch locally.
      MEDF_BILLING_SANDBOX: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  serverProcess.stdout.on('data', recordLog);
  serverProcess.stderr.on('data', recordLog);
  serverProcess.on('exit', (code, signal) => {
    serverProcess = null;
    if (code !== 0 && signal !== 'SIGTERM' && !app.isQuiting) {
      reportFatal(
        'MeDF หยุดทำงาน',
        `เซิร์ฟเวอร์ภายในเครื่องปิดตัวลง (code ${code})\n\n${serverLog.join('').slice(-1500)}`,
      );
    }
  });

  await waitForServer(serverUrl);
}

function stopServer() {
  if (!serverProcess) return;
  const child = serverProcess;
  serverProcess = null;
  child.kill('SIGTERM');
  // Windows ignores SIGTERM for detached node processes often enough to matter.
  setTimeout(() => {
    try {
      child.kill('SIGKILL');
    } catch {
      /* already gone */
    }
  }, 2500);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    backgroundColor: '#f6f7fb',
    title: 'MeDF',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (IS_DEV) mainWindow.webContents.openDevTools({ mode: 'detach' });
  });

  // Switching language in the app writes a cookie and reloads, so this is
  // where the menu finds out about it.
  mainWindow.webContents.on('did-finish-load', () => {
    void refreshMenu();
  });

  // The self-test navigates the window, so it must not start until the initial
  // load has settled — a second loadURL mid-flight aborts the first.
  if (HEADLESS) {
    mainWindow.webContents.once('did-finish-load', () => {
      void runSelfTest();
    });
  }

  // Anything that is not our local server opens in the real browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (serverUrl && url.startsWith(serverUrl.origin)) return { action: 'allow' };
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (serverUrl && !url.startsWith(serverUrl.origin)) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow.loadURL(serverUrl.origin).catch((error) => {
    // A navigation that replaces this one reports ERR_ABORTED; that is not a
    // startup failure.
    if (!String(error?.message ?? error).includes('ERR_ABORTED')) throw error;
  });
}

/**
 * The shell's chrome in the same language as the page inside it.
 *
 * The web app picks a language from the `medf_locale` cookie and falls back to
 * the system one; the menu asks the same two sources in the same order. It was
 * Thai only, which left an English member reading an English page inside a
 * Thai menu bar.
 *
 * These strings are the shell's own — File, Edit, View — and have no
 * counterpart in the web dictionary, so they live here rather than being
 * plumbed across the process boundary.
 */
const MENU_TEXT = {
  th: {
    file: 'ไฟล์',
    myDocuments: 'เอกสารของฉัน',
    home: 'หน้าแรก',
    dataFolder: 'เปิดโฟลเดอร์ข้อมูล',
    quit: 'ออกจากโปรแกรม',
    edit: 'แก้ไข',
    undo: 'ย้อนกลับ',
    redo: 'ทำซ้ำ',
    cut: 'ตัด',
    copy: 'คัดลอก',
    paste: 'วาง',
    selectAll: 'เลือกทั้งหมด',
    view: 'มุมมอง',
    reload: 'โหลดใหม่',
    forceReload: 'โหลดใหม่ทั้งหมด',
    resetZoom: 'ขนาดปกติ',
    zoomIn: 'ขยาย',
    zoomOut: 'ย่อ',
    fullscreen: 'เต็มหน้าจอ',
    devTools: 'เครื่องมือนักพัฒนา',
    account: 'บัญชี',
    billing: 'การสมัครสมาชิก',
    myAccount: 'บัญชีของฉัน',
    help: 'ช่วยเหลือ',
    about: 'เกี่ยวกับ MeDF',
    aboutTagline: 'โปรแกรมแก้ไข PDF แบบลากวาง ทำงานในเครื่องของคุณเอง',
    aboutDataFolder: 'โฟลเดอร์ข้อมูล',
    aboutServer: 'เซิร์ฟเวอร์ภายใน',
    close: 'ปิด',
    website: 'เว็บไซต์ MeDF',
  },
  en: {
    file: 'File',
    myDocuments: 'My documents',
    home: 'Home',
    dataFolder: 'Open data folder',
    quit: 'Quit',
    edit: 'Edit',
    undo: 'Undo',
    redo: 'Redo',
    cut: 'Cut',
    copy: 'Copy',
    paste: 'Paste',
    selectAll: 'Select all',
    view: 'View',
    reload: 'Reload',
    forceReload: 'Force reload',
    resetZoom: 'Actual size',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    fullscreen: 'Full screen',
    devTools: 'Developer tools',
    account: 'Account',
    billing: 'Subscription',
    myAccount: 'My account',
    help: 'Help',
    about: 'About MeDF',
    aboutTagline: 'A drag-and-drop PDF editor that runs on your own machine.',
    aboutDataFolder: 'Data folder',
    aboutServer: 'Local server',
    close: 'Close',
    website: 'MeDF website',
  },
};

/** The language the menu is currently built in, so it is rebuilt only on a change. */
let menuLocale = null;

function systemLocale() {
  return app.getLocale().toLowerCase().startsWith('th') ? 'th' : 'en';
}

/** The page's own choice first, exactly as the server reads it. */
async function preferredLocale() {
  try {
    const jar = await session.defaultSession.cookies.get({ name: 'medf_locale' });
    const value = jar[0]?.value;
    if (value === 'th' || value === 'en') return value;
  } catch {
    /* no session yet; fall through to the system language */
  }
  return systemLocale();
}

/** Rebuilds the menu when the language has changed. Safe to call often. */
async function refreshMenu() {
  const locale = await preferredLocale();
  if (locale === menuLocale) return;
  menuLocale = locale;
  buildMenu(MENU_TEXT[locale]);
}

function buildMenu(text) {
  const go = (route) => () => {
    if (mainWindow && serverUrl) void mainWindow.loadURL(new URL(route, serverUrl.origin).toString());
  };

  const template = [
    {
      label: text.file,
      submenu: [
        { label: text.myDocuments, accelerator: 'CmdOrCtrl+Shift+O', click: go('/app') },
        { label: text.home, click: go('/') },
        { type: 'separator' },
        {
          label: text.dataFolder,
          click: () => void shell.openPath(dataDir),
        },
        { type: 'separator' },
        { role: 'quit', label: text.quit },
      ],
    },
    {
      label: text.edit,
      submenu: [
        { role: 'undo', label: text.undo },
        { role: 'redo', label: text.redo },
        { type: 'separator' },
        { role: 'cut', label: text.cut },
        { role: 'copy', label: text.copy },
        { role: 'paste', label: text.paste },
        { role: 'selectAll', label: text.selectAll },
      ],
    },
    {
      label: text.view,
      submenu: [
        { role: 'reload', label: text.reload },
        { role: 'forceReload', label: text.forceReload },
        { type: 'separator' },
        { role: 'resetZoom', label: text.resetZoom },
        { role: 'zoomIn', label: text.zoomIn },
        { role: 'zoomOut', label: text.zoomOut },
        { type: 'separator' },
        { role: 'togglefullscreen', label: text.fullscreen },
        { role: 'toggleDevTools', label: text.devTools },
      ],
    },
    {
      label: text.account,
      submenu: [
        { label: text.billing, click: go('/app/billing') },
        { label: text.myAccount, click: go('/app/account') },
      ],
    },
    {
      label: text.help,
      submenu: [
        {
          label: text.about,
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: text.about,
              message: `MeDF ${app.getVersion()}`,
              detail: [
                text.aboutTagline,
                '',
                `${text.aboutDataFolder}: ${dataDir}`,
                serverUrl ? `${text.aboutServer}: ${serverUrl.origin}` : '',
              ]
                .filter(Boolean)
                .join('\n'),
              buttons: [text.close],
            });
          },
        },
        {
          label: text.website,
          click: () => void shell.openExternal('https://github.com/SuruchBoss/MeDF'),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/**
 * Headless self-test used by `scripts/verify-shell.mjs`: walks a few routes,
 * writes a screenshot of each to `MEDF_SELFTEST_DIR`, then exits. It only runs
 * when that variable is set, so it is inert in a normal launch.
 */
async function runSelfTest() {
  const outDir = process.env.MEDF_SELFTEST_DIR;
  // The landing page is already loaded; the rest are navigated to in turn.
  const routes = [
    ['landing', null],
    ['register', '/register'],
    ['pricing', '/pricing'],
    ['app', '/app'],
  ];

  try {
    fs.mkdirSync(outDir, { recursive: true });
    for (const [name, route] of routes) {
      if (route) await mainWindow.loadURL(new URL(route, serverUrl.origin).toString());
      // Give web fonts and the first paint a moment to settle.
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const image = await mainWindow.webContents.capturePage();
      fs.writeFileSync(path.join(outDir, `${name}.png`), image.toPNG());
      console.log(`[selftest] ${route ?? '/'} -> ${name}.png (${mainWindow.webContents.getURL()})`);
    }
    console.log('[selftest] ok');
    app.isQuiting = true;
    stopServer();
    app.exit(0);
  } catch (error) {
    console.error(`[selftest] failed: ${error.message}`);
    app.isQuiting = true;
    stopServer();
    app.exit(1);
  }
}

// One instance only: a second launch focuses the existing window.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  ipcMain.handle('medf:info', () => ({
    version: app.getVersion(),
    dataDir,
    platform: process.platform,
  }));

  app.whenReady().then(async () => {
    try {
      await startServer();
      void refreshMenu();
      await createWindow();
    } catch (error) {
      reportFatal('เริ่มต้น MeDF ไม่สำเร็จ', `${error.message}\n\n${serverLog.join('').slice(-1500)}`);
      app.quit();
    }
  });

  app.on('window-all-closed', () => {
    app.isQuiting = true;
    stopServer();
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (!mainWindow && serverUrl) void createWindow();
  });

  app.on('before-quit', () => {
    app.isQuiting = true;
    stopServer();
  });
}
