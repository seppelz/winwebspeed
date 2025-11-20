import { contextBridge, ipcRenderer } from 'electron';
import { NetworkStats, CPUStats, RAMStats, SystemStats } from '../types';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  onNetworkStatsUpdate: (callback: (stats: NetworkStats) => void) => {
    ipcRenderer.on('network-stats-update', (event, stats: NetworkStats) => {
      callback(stats);
    });
  },
  onCPUStatsUpdate: (callback: (stats: CPUStats) => void) => {
    ipcRenderer.on('cpu-stats-update', (event, stats: CPUStats) => {
      callback(stats);
    });
  },
  onRAMStatsUpdate: (callback: (stats: RAMStats) => void) => {
    ipcRenderer.on('ram-stats-update', (event, stats: RAMStats) => {
      callback(stats);
    });
  },
  onSystemStatsUpdate: (callback: (stats: SystemStats) => void) => {
    ipcRenderer.on('system-stats-update', (event, stats: SystemStats) => {
      callback(stats);
    });
  },
  requestStatsUpdate: () => {
    ipcRenderer.send('request-stats-update');
  },
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  }
});


