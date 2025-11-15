// Declare the electronAPI type
interface ElectronAPI {
  onNetworkStatsUpdate: (callback: (stats: NetworkStats) => void) => void;
  removeAllListeners: (channel: string) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

interface NetworkStats {
  downloadSpeed: number;
  uploadSpeed: number;
  downloadBytes: number;
  uploadBytes: number;
  interfaceName: string;
  interfaceType: 'WiFi' | 'Ethernet' | 'Unknown';
}

// Update the overlay with new network stats
function updateStats(stats: NetworkStats): void {
  console.log('Updating overlay stats:', stats);
  
  const downloadElement = document.getElementById('download-speed');
  if (downloadElement) {
    downloadElement.textContent = stats.downloadSpeed.toFixed(1);
    console.log('Download speed updated to:', stats.downloadSpeed.toFixed(1));
  } else {
    console.error('Download element not found!');
  }

  const uploadElement = document.getElementById('upload-speed');
  if (uploadElement) {
    uploadElement.textContent = stats.uploadSpeed.toFixed(1);
    console.log('Upload speed updated to:', stats.uploadSpeed.toFixed(1));
  } else {
    console.error('Upload element not found!');
  }
}

// Initialize the overlay
document.addEventListener('DOMContentLoaded', () => {
  console.log('Taskbar overlay initialized');
  console.log('Download element exists:', !!document.getElementById('download-speed'));
  console.log('Upload element exists:', !!document.getElementById('upload-speed'));
  
  // Listen for network stats updates from main process
  if (window.electronAPI) {
    console.log('electronAPI is available');
    window.electronAPI.onNetworkStatsUpdate((stats: NetworkStats) => {
      console.log('Received stats update in overlay:', stats);
      updateStats(stats);
    });
    
    // Request initial stats
    console.log('Waiting for network stats...');
  } else {
    console.error('electronAPI not available - window.electronAPI:', window.electronAPI);
  }
});

