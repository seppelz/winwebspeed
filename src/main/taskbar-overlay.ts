import { BrowserWindow, screen } from 'electron';
import * as path from 'path';
import { NetworkStats, CPUStats, RAMStats } from '../types';

export class TaskbarOverlay {
  private overlayWindow: BrowserWindow | null = null;
  private isReady: boolean = false;
  private keepOnTopInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.createOverlay();
  }

  private createOverlay(): void {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    const { x, y } = primaryDisplay.workArea;

    // Get taskbar height (usually 40-48px on Windows 11)
    const taskbarHeight = primaryDisplay.size.height - primaryDisplay.workArea.height;
    
    // Position at bottom right, just above taskbar, aligned with system tray
    // Account for system tray icons area (usually ~200-250px from right edge)
    const overlayWidth = 520; // Width for horizontal layout with progress bars, CPU, and RAM stats
    const overlayHeight = 50; // Height for horizontal layout with progress bars
    const systemTrayArea = 250; // Approximate space for system tray icons
    const overlayX = x + width - systemTrayArea - overlayWidth - 5; // Position before system tray
    const overlayY = y + height - overlayHeight - taskbarHeight - 2; // 2px above taskbar

    this.overlayWindow = new BrowserWindow({
      width: overlayWidth,
      height: overlayHeight,
      x: overlayX,
      y: overlayY,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: true, // Make it movable
      focusable: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../preload/preload.js'),
        // Optimize memory usage
        backgroundThrottling: false,
        // Security: enable web security
        webSecurity: true
      }
    });
    
    // Set CSP header via session for additional protection
    this.overlayWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline'; " +
            "style-src 'self' 'unsafe-inline'; " +
            "img-src 'none'; " +
            "font-src 'none'; " +
            "connect-src 'none'; " +
            "object-src 'none'; " +
            "base-uri 'self'; " +
            "form-action 'none'; " +
            "frame-ancestors 'none'"
          ]
        }
      });
    });

    // Ensure it stays on top with highest priority
    this.overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    
    // Re-apply alwaysOnTop periodically to ensure it stays on top
    this.keepOnTopInterval = setInterval(() => {
      if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
        this.overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1);
        // Ensure it's visible
        if (!this.overlayWindow.isVisible()) {
          this.overlayWindow.show();
        }
      }
    }, 1000); // Check every second

    // Load overlay HTML
    const htmlPath = path.join(__dirname, '../renderer/taskbar-overlay.html');
    this.overlayWindow.loadFile(htmlPath);

    // Allow mouse events for dragging
    this.overlayWindow.setIgnoreMouseEvents(false);

    // Keep on all workspaces
    this.overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    // Wait for window to be ready before allowing updates
    this.overlayWindow.webContents.once('did-finish-load', () => {
      console.log('Taskbar overlay window ready');
      this.isReady = true;
      // DevTools disabled for production to reduce memory usage
      // Uncomment for debugging: this.overlayWindow?.webContents.openDevTools({ mode: 'detach' });
    });

    // Ensure window stays on top even when other windows are focused
    this.overlayWindow.on('blur', () => {
      this.overlayWindow?.setAlwaysOnTop(true, 'screen-saver', 1);
    });
    
    // Monitor window state and ensure it stays on top
    this.overlayWindow.on('show', () => {
      this.overlayWindow?.setAlwaysOnTop(true, 'screen-saver', 1);
    });
  }

  updateStats(stats: NetworkStats): void {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      if (this.isReady) {
        try {
          this.overlayWindow.webContents.send('network-stats-update', stats);
        } catch (error) {
          console.error('Error sending stats to overlay:', error);
        }
      } else {
        // If not ready yet, queue the first update
        const queuedStats = stats;
        this.overlayWindow.webContents.once('did-finish-load', () => {
          this.isReady = true;
          this.overlayWindow?.webContents.send('network-stats-update', queuedStats);
        });
      }
    }
  }

  updateCPUStats(stats: CPUStats): void {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      if (this.isReady) {
        try {
          this.overlayWindow.webContents.send('cpu-stats-update', stats);
        } catch (error) {
          console.error('Error sending CPU stats to overlay:', error);
        }
      }
    }
  }

  updateRAMStats(stats: RAMStats): void {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      if (this.isReady) {
        try {
          this.overlayWindow.webContents.send('ram-stats-update', stats);
        } catch (error) {
          console.error('Error sending RAM stats to overlay:', error);
        }
      }
    }
  }

  show(): void {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.show();
    }
  }

  hide(): void {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.hide();
    }
  }

  destroy(): void {
    if (this.keepOnTopInterval) {
      clearInterval(this.keepOnTopInterval);
      this.keepOnTopInterval = null;
    }
    if (this.overlayWindow) {
      this.overlayWindow.destroy();
      this.overlayWindow = null;
    }
  }
}

