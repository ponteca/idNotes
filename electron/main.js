const { app, BrowserWindow, net, protocol, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const APP_PROTOCOL = 'idnotes';

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_PROTOCOL,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

const getDistPath = () => {
  const appPath = app.getAppPath();
  const candidates = [
    path.join(appPath, 'dist'),
    path.join(appPath, '..', 'dist'),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
};

const getWindowIconPath = () => {
  const appPath = app.getAppPath();
  const candidates = [
    path.join(appPath, 'assets', 'images', 'idnotes.ico'),
    path.join(appPath, '..', 'assets', 'images', 'idnotes.ico'),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate));
};

const getAssetPath = (url) => {
  const parsedUrl = new URL(url);
  const requestedPath = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, '')) || 'index.html';
  const distPath = getDistPath();
  const filePath = path.join(distPath, requestedPath);

  if (fs.existsSync(filePath)) {
    return filePath;
  }

  if (!path.extname(filePath)) {
    const htmlPath = `${filePath}.html`;

    if (fs.existsSync(htmlPath)) {
      return htmlPath;
    }
  }

  return path.join(distPath, 'index.html');
};

const registerAppProtocol = () => {
  protocol.handle(APP_PROTOCOL, async (request) => {
    const filePath = getAssetPath(request.url);
    return net.fetch(pathToFileURL(filePath).toString());
  });
};

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 430,
    height: 860,
    minWidth: 390,
    minHeight: 720,
    title: 'idNotes',
    icon: getWindowIconPath(),
    backgroundColor: '#0a0e1a',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }

    return { action: 'deny' };
  });

  mainWindow.loadURL(`${APP_PROTOCOL}://app/`);
};

app.whenReady().then(() => {
  registerAppProtocol();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
