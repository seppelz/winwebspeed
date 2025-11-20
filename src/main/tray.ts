import { app, Tray, Menu, nativeImage } from 'electron';
import * as path from 'path';
import { NetworkStats } from '../types';
import { logger } from '../utils/logger';

// Helper function to check if app is set to start at login
function isStartupEnabled(): boolean {
  try {
    const settings = app.getLoginItemSettings({
      path: process.execPath,
      args: []
    });
    return settings.openAtLogin;
  } catch (error) {
    logger.error('Failed to get login item settings:', error);
    return false;
  }
}

// Helper function to toggle startup
function toggleStartup(enabled: boolean): void {
  try {
    // On Windows, the name in startup list comes from the productName or app name
    // In development, it may show as "electron", but in packaged app it will show as "WebSpeed"
    const result = app.setLoginItemSettings({
      openAtLogin: enabled,
      openAsHidden: true, // Start hidden (in system tray)
      name: app.getName() || 'WebSpeed', // Use app name, fallback to WebSpeed
      // Specify the executable path for Windows
      path: process.execPath,
      args: []
    });
    
    // Verify it was set correctly
    const settings = app.getLoginItemSettings({
      path: process.execPath,
      args: []
    });
    
    if (settings.openAtLogin !== enabled) {
      logger.error('Failed to set startup: expected', enabled, 'but got', settings.openAtLogin);
    }
  } catch (error) {
    logger.error('Failed to set login item settings:', error);
  }
}

export class SystemTray {
  private tray: Tray | null = null;
  private statsWindow: Electron.BrowserWindow | null = null;

  constructor(statsWindow: Electron.BrowserWindow) {
    this.statsWindow = statsWindow;
    this.createTray();
  }

  private createTray(): void {
    // Create a simple icon (we'll use a default icon for now)
    // In production, this should load from assets/icon.ico
    const iconPath = path.join(__dirname, '../../assets/icon.ico');
    
    // Create a native image - if icon doesn't exist, create a simple one
    let icon: Electron.NativeImage;
    try {
      icon = nativeImage.createFromPath(iconPath);
      if (icon.isEmpty()) {
        icon = this.createDefaultIcon();
      }
    } catch (error) {
      icon = this.createDefaultIcon();
    }

    this.tray = new Tray(icon);
    this.tray.setToolTip('WebSpeed - Initializing...');

    // Create context menu with startup option
    const updateContextMenu = () => {
      const startupEnabled = isStartupEnabled();
      const contextMenu = Menu.buildFromTemplate([
        {
          label: 'Show Stats',
          click: () => {
            if (this.statsWindow) {
              this.statsWindow.isVisible() 
                ? this.statsWindow.hide() 
                : this.statsWindow.show();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Start at Login',
          type: 'checkbox',
          checked: startupEnabled,
          click: (menuItem) => {
            const newState = !startupEnabled;
            toggleStartup(newState);
            // Update menu to reflect new state
            updateContextMenu();
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          click: () => {
            app.quit();
          }
        }
      ]);
      
      if (this.tray) {
        this.tray.setContextMenu(contextMenu);
      }
    };
    
    // Create initial context menu
    updateContextMenu();

    // Handle click events (Windows)
    this.tray.on('click', () => {
      if (this.statsWindow) {
        if (this.statsWindow.isVisible()) {
          this.statsWindow.hide();
        } else {
          this.statsWindow.show();
          this.statsWindow.focus();
        }
      }
    });
  }

  updateTooltip(stats: NetworkStats): void {
    if (this.tray) {
      const tooltip = `↓ ${stats.downloadSpeed.toFixed(0)} ↑ ${stats.uploadSpeed.toFixed(0)} kbps`;
      this.tray.setToolTip(tooltip);
    }
  }

  private createDefaultIcon(): Electron.NativeImage {
    // Create a classic lightning bolt (blitz) icon for speed
    // Classic lightning bolt: narrow top, zigzag middle, narrow bottom
    const size = 16;
    const data = Buffer.alloc(size * size * 4);
    
    // Fill with transparent background
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const offset = (y * size + x) * 4;
        data[offset] = 0;       // R
        data[offset + 1] = 0;   // G
        data[offset + 2] = 0;   // B
        data[offset + 3] = 0;   // A (transparent)
      }
    }
    
    // Classic lightning bolt shape (yellow/gold)
    // Define the lightning bolt path as a series of points
    // Top: narrow point at center
    // Middle: zigzag (left then right)
    // Bottom: narrow point offset
    
    // Top section: narrow point (y: 0-3)
    for (let y = 0; y <= 3; y++) {
      const centerX = 8;
      const width = Math.max(1, 2 - Math.floor(y / 2));
      for (let x = centerX - width; x <= centerX + width; x++) {
        if (x >= 0 && x < size && y >= 0 && y < size) {
          const offset = (y * size + x) * 4;
          data[offset] = 255;     // R (yellow)
          data[offset + 1] = 200; // G
          data[offset + 2] = 0;   // B
          data[offset + 3] = 255; // A
        }
      }
    }
    
    // Upper middle: shift left (y: 4-6)
    for (let y = 4; y <= 6; y++) {
      const centerX = 6; // Shifted left
      const width = 2;
      for (let x = centerX - width; x <= centerX + width; x++) {
        if (x >= 0 && x < size && y >= 0 && y < size) {
          const offset = (y * size + x) * 4;
          data[offset] = 255;     // R (yellow)
          data[offset + 1] = 200; // G
          data[offset + 2] = 0;   // B
          data[offset + 3] = 255; // A
        }
      }
    }
    
    // Lower middle: shift right (y: 7-9)
    for (let y = 7; y <= 9; y++) {
      const centerX = 10; // Shifted right
      const width = 2;
      for (let x = centerX - width; x <= centerX + width; x++) {
        if (x >= 0 && x < size && y >= 0 && y < size) {
          const offset = (y * size + x) * 4;
          data[offset] = 255;     // R (yellow)
          data[offset + 1] = 200; // G
          data[offset + 2] = 0;   // B
          data[offset + 3] = 255; // A
        }
      }
    }
    
    // Bottom section: narrow point offset right (y: 10-15)
    for (let y = 10; y <= 15; y++) {
      const centerX = 9; // Slightly right
      const width = Math.max(1, 2 - Math.floor((15 - y) / 2));
      for (let x = centerX - width; x <= centerX + width; x++) {
        if (x >= 0 && x < size && y >= 0 && y < size) {
          const offset = (y * size + x) * 4;
          data[offset] = 255;     // R (yellow)
          data[offset + 1] = 200; // G
          data[offset + 2] = 0;   // B
          data[offset + 3] = 255; // A
        }
      }
    }
    
    // Connect the sections with diagonal lines for smooth zigzag
    // Connect top to upper middle (diagonal from center to left)
    for (let y = 3; y <= 4; y++) {
      const x = Math.floor(8 - (y - 3) * 2);
      if (x >= 0 && x < size && y >= 0 && y < size) {
        const offset = (y * size + x) * 4;
        data[offset] = 255;
        data[offset + 1] = 200;
        data[offset + 2] = 0;
        data[offset + 3] = 255;
      }
    }
    
    // Connect upper middle to lower middle (diagonal from left to right)
    for (let y = 6; y <= 7; y++) {
      const x = Math.floor(6 + (y - 6) * 4);
      if (x >= 0 && x < size && y >= 0 && y < size) {
        const offset = (y * size + x) * 4;
        data[offset] = 255;
        data[offset + 1] = 200;
        data[offset + 2] = 0;
        data[offset + 3] = 255;
      }
    }
    
    // Connect lower middle to bottom (diagonal from right to slightly right)
    for (let y = 9; y <= 10; y++) {
      const x = Math.floor(10 - (y - 9) * 1);
      if (x >= 0 && x < size && y >= 0 && y < size) {
        const offset = (y * size + x) * 4;
        data[offset] = 255;
        data[offset + 1] = 200;
        data[offset + 2] = 0;
        data[offset + 3] = 255;
      }
    }
    
    // Add highlight/shine on the left edge
    for (let y = 2; y <= 12; y++) {
      let x = 0;
      if (y <= 3) x = 6;
      else if (y <= 6) x = 4;
      else if (y <= 9) x = 8;
      else x = 7;
      
      if (x >= 0 && x < size && y >= 0 && y < size) {
        const offset = (y * size + x) * 4;
        if (data[offset + 3] > 0) { // If pixel is part of lightning
          data[offset] = 255;     // R (brighter)
          data[offset + 1] = 255; // G (brighter)
          data[offset + 2] = 150; // B (brighter)
        }
      }
    }
    
    const icon = nativeImage.createFromBuffer(data, { width: size, height: size });
    
    // Fallback: simple zigzag pattern
    if (icon.isEmpty()) {
      const fallbackData = Buffer.alloc(size * size * 4);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const offset = (y * size + x) * 4;
          // Simple zigzag lightning pattern
          let centerX = 8;
          if (y < 4) centerX = 8;
          else if (y < 7) centerX = 6;
          else if (y < 10) centerX = 10;
          else centerX = 9;
          
          if (Math.abs(x - centerX) < 2) {
            fallbackData[offset] = 255;     // R
            fallbackData[offset + 1] = 200; // G
            fallbackData[offset + 2] = 0;   // B
            fallbackData[offset + 3] = 255; // A
          } else {
            fallbackData[offset] = 0;
            fallbackData[offset + 1] = 0;
            fallbackData[offset + 2] = 0;
            fallbackData[offset + 3] = 0;
          }
        }
      }
      return nativeImage.createFromBuffer(fallbackData, { width: size, height: size });
    }
    
    return icon;
  }

  destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}

