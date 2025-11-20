import * as os from 'os';
import * as si from 'systeminformation';
import { NetworkStats, NetworkInterface } from '../types';
import { logger } from '../utils/logger';

export class NetworkMonitor {
  private previousStats: Map<string, NetworkInterface> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;
  private callback: (stats: NetworkStats) => void;
  private isRunning: boolean = false;
  private monitoringStartTime: number = 0;
  private initialDownloadBytes: number = 0;
  private initialUploadBytes: number = 0;

  constructor(callback: (stats: NetworkStats) => void) {
    this.callback = callback;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.monitoringStartTime = Date.now(); // Set start time when monitoring begins
    // Get initial stats to establish baseline
    await this.collectInitialStats();
    
    // Start monitoring loop
    this.updateInterval = setInterval(async () => {
      await this.updateStats();
    }, 1000);
  }

  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.isRunning = false;
  }

  private async collectInitialStats(): Promise<void> {
    try {
      const stats = await si.networkStats();
      
      let totalInitialDownload = 0;
      let totalInitialUpload = 0;
      
      // Only store essential interfaces to reduce memory
      for (const stat of stats) {
        // Skip only actual loopback interfaces
        if (stat.iface.toLowerCase() === 'lo' || 
            stat.iface.toLowerCase() === 'loopback') {
          continue;
        }
        
        // Sum up initial bytes from all interfaces
        totalInitialDownload += stat.rx_bytes || 0;
        totalInitialUpload += stat.tx_bytes || 0;
        
        // Store stats for all non-loopback interfaces
        this.previousStats.set(stat.iface, {
          name: stat.iface,
          bytesReceived: stat.rx_bytes || 0,
          bytesSent: stat.tx_bytes || 0,
          type: this.determineInterfaceType(null, stat.iface)
        });
      }
      
      // Store initial totals for calculating difference
      this.initialDownloadBytes = totalInitialDownload;
      this.initialUploadBytes = totalInitialUpload;
    } catch (error) {
      logger.error('Error collecting initial stats:', error);
    }
  }

  private async updateStats(): Promise<void> {
    try {
      const stats = await si.networkStats();
      const interfaces = os.networkInterfaces();
      let totalDownload = 0;
      let totalUpload = 0;
      let activeInterface: NetworkInterface | null = null;

      for (const stat of stats) {
        // Skip only actual loopback interfaces
        if (stat.iface.toLowerCase() === 'lo' || 
            stat.iface.toLowerCase() === 'loopback') {
          continue;
        }
        
        const iface = this.findInterfaceByName(stat.iface, interfaces);
        const currentRx = stat.rx_bytes || 0;
        const currentTx = stat.tx_bytes || 0;
        const previous = this.previousStats.get(stat.iface);

        // If we have previous stats, calculate speed
        if (previous) {
          const timeDiff = 1; // 1 second
          const downloadDiff = currentRx - previous.bytesReceived;
          const uploadDiff = currentTx - previous.bytesSent;

          // Convert bytes to kilobits per second
          const downloadKbps = (downloadDiff * 8) / (timeDiff * 1000);
          const uploadKbps = (uploadDiff * 8) / (timeDiff * 1000);

          // Only count positive speeds (ignore negative values from counter resets)
          if (downloadKbps >= 0 && uploadKbps >= 0) {
            totalDownload += downloadKbps;
            totalUpload += uploadKbps;
          }

          // Track the primary active interface (prefer interfaces with activity)
          if ((downloadKbps > 0 || uploadKbps > 0) && (!activeInterface || downloadKbps + uploadKbps > 0)) {
            activeInterface = {
              name: stat.iface,
              bytesReceived: currentRx,
              bytesSent: currentTx,
              type: iface ? this.determineInterfaceType(iface, stat.iface) : this.determineInterfaceType(null, stat.iface)
            };
          }
        }

        // Always update previous stats for next iteration
        this.previousStats.set(stat.iface, {
          name: stat.iface,
          bytesReceived: currentRx,
          bytesSent: currentTx,
          type: iface ? this.determineInterfaceType(iface, stat.iface) : this.determineInterfaceType(null, stat.iface)
        });
      }
      
      // If no active interface found but we have stats, use the first non-loopback one
      if (!activeInterface && stats.length > 0) {
        const firstStat = stats.find(s => 
          !s.iface.toLowerCase().includes('loopback') && 
          !s.iface.toLowerCase().includes('lo') &&
          s.iface !== 'lo'
        );
        if (firstStat) {
          const iface = this.findInterfaceByName(firstStat.iface, interfaces);
          activeInterface = {
            name: firstStat.iface,
            bytesReceived: firstStat.rx_bytes || 0,
            bytesSent: firstStat.tx_bytes || 0,
            type: iface ? this.determineInterfaceType(iface, firstStat.iface) : this.determineInterfaceType(null, firstStat.iface)
          };
        }
      }

      // Round to 2 decimal places and ensure non-negative
      const downloadSpeed = Math.max(0, Math.round(totalDownload * 100) / 100);
      const uploadSpeed = Math.max(0, Math.round(totalUpload * 100) / 100);

      // Calculate total bytes transferred since monitoring started
      let totalCurrentDownload = 0;
      let totalCurrentUpload = 0;
      
      for (const stat of stats) {
        if (stat.iface.toLowerCase() === 'lo' || 
            stat.iface.toLowerCase() === 'loopback') {
          continue;
        }
        totalCurrentDownload += stat.rx_bytes || 0;
        totalCurrentUpload += stat.tx_bytes || 0;
      }
      
      // Calculate difference (bytes transferred since monitoring started)
      const downloadBytesSinceStart = Math.max(0, totalCurrentDownload - this.initialDownloadBytes);
      const uploadBytesSinceStart = Math.max(0, totalCurrentUpload - this.initialUploadBytes);

      this.callback({
        downloadSpeed,
        uploadSpeed,
        downloadBytes: downloadBytesSinceStart,
        uploadBytes: uploadBytesSinceStart,
        interfaceName: activeInterface?.name || 'Unknown',
        interfaceType: activeInterface?.type || 'Unknown',
        monitoringStartTime: this.monitoringStartTime
      });
    } catch (error) {
      logger.error('Error updating network stats:', error);
      // Send zero speeds on error
      this.callback({
        downloadSpeed: 0,
        uploadSpeed: 0,
        downloadBytes: 0,
        uploadBytes: 0,
        interfaceName: 'Unknown',
        interfaceType: 'Unknown',
        monitoringStartTime: this.monitoringStartTime
      });
    }
  }

  private findInterfaceByName(
    name: string,
    interfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]>
  ): os.NetworkInterfaceInfo | null {
    // Direct lookup by interface name
    const ifaceAddrs = interfaces[name];
    if (ifaceAddrs && ifaceAddrs.length > 0) {
      // Find the first non-internal IPv4 address
      const addr = ifaceAddrs.find(a => !a.internal && a.family === 'IPv4');
      if (addr) {
        return addr;
      }
      // If no IPv4, return first non-internal
      return ifaceAddrs.find(a => !a.internal) || null;
    }
    
    // Fallback: search all interfaces for a match
    for (const [ifaceName, addrs] of Object.entries(interfaces)) {
      if (!addrs) continue;
      if (ifaceName.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(ifaceName.toLowerCase())) {
        const addr = addrs.find(a => !a.internal && a.family === 'IPv4');
        if (addr) {
          return addr;
        }
      }
    }
    
    return null;
  }

  private isRelevantInterface(iface: os.NetworkInterfaceInfo): boolean {
    // Filter out loopback and internal interfaces
    if (iface.internal) return false;
    
    // Only include IPv4 addresses for now
    if (iface.family !== 'IPv4') return false;
    
    return true;
  }

  private determineInterfaceType(
    iface: os.NetworkInterfaceInfo | null,
    name: string
  ): 'WiFi' | 'Ethernet' | 'Unknown' {
    const nameLower = name.toLowerCase();
    
    // Check for WiFi indicators
    if (
      nameLower.includes('wifi') ||
      nameLower.includes('wireless') ||
      nameLower.includes('wlan') ||
      nameLower.includes('802.11')
    ) {
      return 'WiFi';
    }
    
    // Check for Ethernet indicators
    if (
      nameLower.includes('ethernet') ||
      nameLower.includes('lan') ||
      nameLower.includes('local area connection') ||
      nameLower.includes('ethernet adapter')
    ) {
      return 'Ethernet';
    }
    
    // Default to Ethernet for physical adapters (most common case)
    return 'Ethernet';
  }
}


