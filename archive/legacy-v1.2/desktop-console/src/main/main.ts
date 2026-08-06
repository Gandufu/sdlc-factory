import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { app, BrowserWindow, net, protocol, session, shell } from 'electron';
import squirrelStartup from 'electron-squirrel-startup';
import { registerIpc } from './ipc';
import { isSafeExternalUrl, isTrustedRendererUrl, resolveAppAsset } from './security';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

if (squirrelStartup) app.quit();
app.setAppUserModelId('dev.sdlc.factory');

protocol.registerSchemesAsPrivileged([{
  scheme: 'app',
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
}]);

/** 创建具备 sandbox、导航限制和最小窗口尺寸的唯一主窗口。 */
const createWindow = (): BrowserWindow => {
  const window = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 720,
    show: false,
    backgroundColor: '#f2f5f8',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
    },
  });
  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedRendererUrl(url, MAIN_WINDOW_VITE_DEV_SERVER_URL)) event.preventDefault();
  });
  void window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL ?? 'app://bundle/index.html');
  return window;
};

app.whenReady().then(() => {
  // 打包态只从受控 app://bundle 根目录读取静态资源，路径越界在 resolver 中拒绝。
  const rendererRoot = path.join(__dirname, '..', 'renderer', MAIN_WINDOW_VITE_NAME);
  protocol.handle('app', (request) => {
    try {
      return net.fetch(pathToFileURL(resolveAppAsset(rendererRoot, request.url)).toString());
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  registerIpc(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
