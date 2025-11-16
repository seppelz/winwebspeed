import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { NetworkMonitor } from './network';
import { CPUMonitor } from './cpu';
import { SystemTray } from './tray';
import { TaskbarOverlay } from './taskbar-overlay';
import { NetworkStats, CPUStats, RAMStats } from '../types';

let statsWindow: BrowserWindow | null = null;
let tray: SystemTray | null = null;
let taskbarOverlay: TaskbarOverlay | null = null;
let networkMonitor: NetworkMonitor | null = null;
let cpuMonitor: CPUMonitor | null = null;
let isQuitting = false;
let lastStats: NetworkStats | null = null;
let lastCPUStats: CPUStats | null = null;
let lastRAMStats: RAMStats | null = null;

function createWindow(): void {
  statsWindow = new BrowserWindow({
    width: 600,
    height: 1000,
    show: false, // Start hidden
    frame: true,
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/preload.js'),
      // Optimize memory usage
      backgroundThrottling: false,
      // Additional security: disable web security in development only
      // In production, this should be false (default)
      webSecurity: true
    },
    icon: path.join(__dirname, '../../assets/icon.png')
  });
  
  // Set CSP header via session for additional protection
  statsWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    // Only apply CSP to the stats window HTML file
    if (details.url && details.url.startsWith('file://')) {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline'; " +
            "style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' data: file:; " +
            "font-src 'self'; " +
            "connect-src 'none'; " +
            "object-src 'none'; " +
            "base-uri 'self'; " +
            "form-action 'none'; " +
            "frame-ancestors 'none'"
          ]
        }
      });
    } else {
      callback({ responseHeaders: details.responseHeaders });
    }
  });

  // Load the HTML file
  const htmlPath = path.join(__dirname, '../renderer/index.html');
  statsWindow.loadFile(htmlPath);

  // Ensure window is ready before sending stats
  statsWindow.webContents.once('did-finish-load', () => {
    console.log('Stats window loaded and ready');
  });

  // Hide window on close (minimize to tray)
  statsWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      statsWindow?.hide();
    }
  });

  // Handle window visibility
  statsWindow.on('minimize', () => {
    statsWindow?.hide();
  });
}

function initializeApp(): void {
  // Create the stats window
  createWindow();

  // Create system tray
  if (statsWindow) {
    tray = new SystemTray(statsWindow);
  }

  // Create taskbar overlay
  taskbarOverlay = new TaskbarOverlay();

  // Initialize network monitor
  networkMonitor = new NetworkMonitor((stats: NetworkStats) => {
    lastStats = stats;
    
    // Update tray tooltip
    if (tray) {
      tray.updateTooltip(stats);
    }

    // Update taskbar overlay
    if (taskbarOverlay) {
      taskbarOverlay.updateStats(stats);
    }
    

    // Send stats to renderer (always, not just when visible)
    if (statsWindow && !statsWindow.isDestroyed()) {
      statsWindow.webContents.send('network-stats-update', stats);
    }
  });

  // Initialize CPU monitor with RAM callback
  cpuMonitor = new CPUMonitor(
    (stats: CPUStats) => {
      lastCPUStats = stats;
      
      // Send CPU stats to renderer
      if (statsWindow && !statsWindow.isDestroyed()) {
        statsWindow.webContents.send('cpu-stats-update', stats);
      }
      
      // Update taskbar overlay with CPU stats
      if (taskbarOverlay) {
        taskbarOverlay.updateCPUStats(stats);
      }
    },
    (stats: RAMStats) => {
      lastRAMStats = stats;
      
      // Send RAM stats to renderer
      if (statsWindow && !statsWindow.isDestroyed()) {
        statsWindow.webContents.send('ram-stats-update', stats);
      }
      
      // Update taskbar overlay with RAM stats
      if (taskbarOverlay) {
        taskbarOverlay.updateRAMStats(stats);
      }
    }
  );

  // Start monitoring
  networkMonitor.start().catch((error) => {
    console.error('Failed to start network monitoring:', error);
  });

  cpuMonitor.start().catch((error) => {
    console.error('Failed to start CPU monitoring:', error);
  });
}

// App event handlers
app.whenReady().then(() => {
  // Set app name for better display in Windows startup list
  // This helps show "WebSpeed" instead of "electron" in development
  if (!app.isPackaged) {
    app.setName('WebSpeed');
  }
  
  // Check if app was launched at login (should start hidden)
  const loginItemSettings = app.getLoginItemSettings({ 
    path: process.execPath,
    args: []
  });
  const shouldStartHidden = loginItemSettings.wasOpenedAtLogin || loginItemSettings.wasOpenedAsHidden;
  
  initializeApp();
  
  // If started at login, ensure windows stay hidden
  if (shouldStartHidden && statsWindow) {
    statsWindow.hide();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (statsWindow) {
      statsWindow.show();
    }
  });
});

app.on('window-all-closed', () => {
  // On Windows, keep the app running even when all windows are closed
  // The app should only quit when explicitly closed from the tray
});

app.on('before-quit', () => {
  isQuitting = true;
  
  // Cleanup
  if (networkMonitor) {
    networkMonitor.stop();
  }
  
  if (cpuMonitor) {
    cpuMonitor.stop();
  }
  
  if (tray) {
    tray.destroy();
  }
  
  if (taskbarOverlay) {
    taskbarOverlay.destroy();
  }
  
  if (statsWindow) {
    statsWindow.removeAllListeners('close');
    statsWindow.close();
  }
});

// IPC handlers for renderer communication
ipcMain.on('get-initial-stats', () => {
  // This can be used if the renderer needs initial stats
});

ipcMain.on('request-stats-update', (event) => {
  // Validate that the request comes from our window
  if (event.sender !== statsWindow?.webContents) {
    return; // Ignore requests from unknown sources
  }
  // Send the last known stats immediately
  if (lastStats && statsWindow && !statsWindow.isDestroyed()) {
    statsWindow.webContents.send('network-stats-update', lastStats);
  }
  if (lastCPUStats && statsWindow && !statsWindow.isDestroyed()) {
    statsWindow.webContents.send('cpu-stats-update', lastCPUStats);
  }
  if (lastCPUStats && taskbarOverlay) {
    taskbarOverlay.updateCPUStats(lastCPUStats);
  }
  if (lastRAMStats && statsWindow && !statsWindow.isDestroyed()) {
    statsWindow.webContents.send('ram-stats-update', lastRAMStats);
  }
  if (lastRAMStats && taskbarOverlay) {
    taskbarOverlay.updateRAMStats(lastRAMStats);
  }
});

