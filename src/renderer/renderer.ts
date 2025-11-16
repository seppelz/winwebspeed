// Renderer script
export {};

// Declare the electronAPI type
declare global {
  interface Window {
    electronAPI: {
      onNetworkStatsUpdate: (callback: (stats: NetworkStats) => void) => void;
      onCPUStatsUpdate: (callback: (stats: CPUStats) => void) => void;
      onRAMStatsUpdate: (callback: (stats: RAMStats) => void) => void;
      requestStatsUpdate?: () => void;
      removeAllListeners: (channel: string) => void;
    };
    lucide?: {
      createIcons: () => void;
    };
  }
}

interface NetworkStats {
  downloadSpeed: number; // in kbps
  uploadSpeed: number; // in kbps
  downloadBytes: number;
  uploadBytes: number;
  interfaceName: string;
  interfaceType: 'WiFi' | 'Ethernet' | 'Unknown';
  monitoringStartTime?: number; // Timestamp when monitoring started
}

interface CPUStats {
  usage: number | null; // CPU usage percentage (0-100)
  temperature: number | null; // CPU temperature in Celsius
  topProcess: string | null; // Name of the process using most CPU (first 15 chars + ...), excludes System Idle Process
  topProcessUsage: number | null; // CPU usage percentage of the top process (0-100)
}

interface RAMStats {
  usage: number | null; // RAM usage percentage (0-100)
  topProcess: string | null; // Name of the process using most RAM (first 15 chars + ...)
  topProcessUsage: number | null; // RAM usage in MB of the top process
}

// Convert kbps to different units
function convertSpeed(kbps: number, unit: string): number {
  switch (unit) {
    case 'kbps':
      return kbps;
    case 'mbps':
      return kbps / 1000; // Mbit/s
    case 'mbs':
      return (kbps / 1000) / 8; // MB/s (megabytes per second)
    default:
      return kbps / 1000;
  }
}

// Get unit label
function getUnitLabel(unit: string): string {
  switch (unit) {
    case 'kbps':
      return 'kbps';
    case 'mbps':
      return 'Mbit/s';
    case 'mbs':
      return 'MB/s';
    default:
      return 'Mbit/s';
  }
}

// Convert kbps to Mbit/s (1 Mbit/s = 1000 kbps) - kept for backward compatibility
function kbpsToMbps(kbps: number): number {
  return kbps / 1000;
}

// Get max speed from input or localStorage
function getMaxSpeed(): number {
  const input = document.getElementById('max-speed-input') as HTMLInputElement;
  if (input) {
    const value = parseFloat(input.value);
    // Validate: must be a number, positive, and within reasonable bounds (1-10000 Mbit/s)
    if (!isNaN(value) && value > 0 && value <= 10000 && isFinite(value)) {
      localStorage.setItem('webspeed-max-speed', value.toString());
      return value;
    }
    // If invalid, reset to default and update input
    input.value = '100';
  }
  // Try to get from localStorage
  const stored = localStorage.getItem('webspeed-max-speed');
  if (stored) {
    const value = parseFloat(stored);
    if (!isNaN(value) && value > 0 && value <= 10000 && isFinite(value)) {
      return value;
    }
  }
  return 100; // Default 100 Mbit/s
}

// Update progress bar
function updateProgressBar(elementId: string, speedMbps: number, maxSpeedMbps: number): void {
  const progressFill = document.getElementById(elementId);
  if (progressFill) {
    const percentage = Math.min((speedMbps / maxSpeedMbps) * 100, 100);
    progressFill.style.width = `${percentage}%`;
  }
}

// Format bytes to human readable format
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// Get selected unit
function getSelectedUnit(): string {
  const unitSelect = document.getElementById('unit-select') as HTMLSelectElement;
  if (unitSelect) {
    const unit = unitSelect.value;
    // Validate unit is one of the allowed values
    if (['kbps', 'mbps', 'mbs'].includes(unit)) {
      localStorage.setItem('webspeed-unit', unit);
      return unit;
    }
  }
  // Try to get from localStorage
  const stored = localStorage.getItem('webspeed-unit');
  if (stored && ['kbps', 'mbps', 'mbs'].includes(stored)) {
    return stored;
  }
  return 'mbps'; // Default
}

// Update the UI with new network stats
function updateStats(stats: NetworkStats): void {
  // Validate stats object
  if (!stats || typeof stats.downloadSpeed !== 'number' || typeof stats.uploadSpeed !== 'number') {
    return; // Invalid stats, skip update
  }
  
  const maxSpeedMbps = getMaxSpeed();
  const selectedUnit = getSelectedUnit();
  
  // Convert to selected unit
  const downloadSpeed = convertSpeed(stats.downloadSpeed, selectedUnit);
  const uploadSpeed = convertSpeed(stats.uploadSpeed, selectedUnit);
  
  // Validate converted speeds are finite numbers
  if (!isFinite(downloadSpeed) || !isFinite(uploadSpeed)) {
    return; // Invalid speeds, skip update
  }
  
  // For progress bars, always use Mbit/s
  const downloadMbps = kbpsToMbps(stats.downloadSpeed);
  const uploadMbps = kbpsToMbps(stats.uploadSpeed);
  
  // Update download speed
  const downloadElement = document.getElementById('download-speed');
  if (downloadElement) {
    const decimals = selectedUnit === 'mbs' ? 2 : (selectedUnit === 'kbps' ? 0 : 2);
    const speedText = Math.max(0, downloadSpeed).toFixed(decimals);
    downloadElement.textContent = speedText;
    downloadElement.style.display = 'block';
    downloadElement.style.visibility = 'visible';
    downloadElement.classList.add('updating');
    setTimeout(() => {
      downloadElement.classList.remove('updating');
    }, 500);
  }

  // Update upload speed
  const uploadElement = document.getElementById('upload-speed');
  if (uploadElement) {
    const decimals = selectedUnit === 'mbs' ? 2 : (selectedUnit === 'kbps' ? 0 : 2);
    const speedText = Math.max(0, uploadSpeed).toFixed(decimals);
    uploadElement.textContent = speedText;
    uploadElement.style.display = 'block';
    uploadElement.style.visibility = 'visible';
    uploadElement.classList.add('updating');
    setTimeout(() => {
      uploadElement.classList.remove('updating');
    }, 500);
  }
  
  // Update unit labels
  const unitLabel = getUnitLabel(selectedUnit);
  const downloadUnitElement = document.getElementById('download-unit');
  if (downloadUnitElement) {
    downloadUnitElement.textContent = unitLabel;
  }
  const uploadUnitElement = document.getElementById('upload-unit');
  if (uploadUnitElement) {
    uploadUnitElement.textContent = unitLabel;
  }
  
  // Update progress bars (always use Mbit/s for calculation)
  updateProgressBar('download-progress-fill', downloadMbps, maxSpeedMbps);
  updateProgressBar('upload-progress-fill', uploadMbps, maxSpeedMbps);
  
  // Show/hide progress bars based on checkbox
  const showProgressCheckbox = document.getElementById('show-progress') as HTMLInputElement;
  const showProgress = showProgressCheckbox?.checked ?? true;
  const downloadProgressContainer = document.getElementById('download-progress-container');
  const uploadProgressContainer = document.getElementById('upload-progress-container');
  if (downloadProgressContainer) {
    if (showProgress) {
      downloadProgressContainer.classList.remove('hidden');
    } else {
      downloadProgressContainer.classList.add('hidden');
    }
  }
  if (uploadProgressContainer) {
    if (showProgress) {
      uploadProgressContainer.classList.remove('hidden');
    } else {
      uploadProgressContainer.classList.add('hidden');
    }
  }

  // Update interface name
  const interfaceNameElement = document.getElementById('interface-name');
  if (interfaceNameElement) {
    interfaceNameElement.textContent = stats.interfaceName;
  }

  // Update interface type
  const interfaceTypeElement = document.getElementById('interface-type');
  if (interfaceTypeElement) {
    interfaceTypeElement.textContent = stats.interfaceType;
  }

  // Update total bytes
  const totalDownloadElement = document.getElementById('total-download');
  if (totalDownloadElement) {
    totalDownloadElement.textContent = formatBytes(stats.downloadBytes);
  }

  const totalUploadElement = document.getElementById('total-upload');
  if (totalUploadElement) {
    totalUploadElement.textContent = formatBytes(stats.uploadBytes);
  }

  // Update monitoring start time
  const monitoringSinceElement = document.getElementById('monitoring-since');
  if (monitoringSinceElement && stats.monitoringStartTime) {
    const startTime = new Date(stats.monitoringStartTime);
    const now = new Date();
    const diffMs = now.getTime() - startTime.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    let timeString: string;
    if (diffDays > 0) {
      timeString = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      timeString = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffMinutes > 0) {
      timeString = `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    } else {
      timeString = 'Just now';
    }
    
    // Also show the actual time
    const timeFormatted = startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    monitoringSinceElement.textContent = `${timeFormatted} (${timeString})`;
  }
}

// Update the UI with CPU stats
function updateCPUStats(stats: CPUStats): void {
  // Validate stats object
  if (!stats) {
    return;
  }
  
  // Update CPU usage
  const cpuUsageElement = document.getElementById('cpu-usage');
  if (cpuUsageElement) {
    if (stats.usage !== null && stats.usage !== undefined) {
      cpuUsageElement.textContent = stats.usage.toFixed(1);
      cpuUsageElement.classList.add('updating');
      setTimeout(() => {
        cpuUsageElement.classList.remove('updating');
      }, 500);
    } else {
      cpuUsageElement.textContent = '--';
    }
  }
  
  // Update CPU temperature
  const cpuTempElement = document.getElementById('cpu-temperature');
  const cpuTempContainer = document.getElementById('cpu-temp-container');
  if (cpuTempElement && cpuTempContainer) {
    if (stats.temperature !== null && stats.temperature !== undefined) {
      cpuTempElement.textContent = stats.temperature.toFixed(1);
      cpuTempContainer.style.display = 'block';
      cpuTempElement.classList.add('updating');
      setTimeout(() => {
        cpuTempElement.classList.remove('updating');
      }, 500);
    } else {
      cpuTempElement.textContent = '--';
      cpuTempContainer.style.display = 'none';
    }
  }
  
  // Update top CPU process
  const cpuProcessContainer = document.getElementById('cpu-process-container');
  const cpuProcessName = document.getElementById('cpu-process-name');
  const cpuProcessUsage = document.getElementById('cpu-process-usage');
  if (cpuProcessContainer && cpuProcessName && cpuProcessUsage) {
    if (stats.topProcess !== null && stats.topProcess !== undefined && stats.topProcess.trim() !== '') {
      cpuProcessName.textContent = stats.topProcess;
      
      if (stats.topProcessUsage !== null && stats.topProcessUsage !== undefined) {
        cpuProcessUsage.textContent = `CPU: ${stats.topProcessUsage.toFixed(1)}%`;
      } else {
        cpuProcessUsage.textContent = 'CPU: --';
      }
      
      cpuProcessContainer.style.display = 'block';
    } else {
      cpuProcessName.textContent = '--';
      cpuProcessUsage.textContent = 'CPU: --';
      cpuProcessContainer.style.display = 'none';
    }
  }
}

// Update the UI with RAM stats
function updateRAMStats(stats: RAMStats): void {
  // Validate stats object
  if (!stats) {
    return;
  }
  
  // Update RAM usage
  const ramUsageElement = document.getElementById('ram-usage');
  if (ramUsageElement) {
    if (stats.usage !== null && stats.usage !== undefined) {
      ramUsageElement.textContent = stats.usage.toFixed(1);
      ramUsageElement.classList.add('updating');
      setTimeout(() => {
        ramUsageElement.classList.remove('updating');
      }, 500);
    } else {
      ramUsageElement.textContent = '--';
    }
  }
  
  // Update top RAM process
  const ramProcessContainer = document.getElementById('ram-process-container');
  const ramProcessName = document.getElementById('ram-process-name');
  const ramProcessUsage = document.getElementById('ram-process-usage');
  if (ramProcessContainer && ramProcessName && ramProcessUsage) {
    if (stats.topProcess !== null && stats.topProcess !== undefined && stats.topProcess.trim() !== '') {
      ramProcessName.textContent = stats.topProcess;
      
      if (stats.topProcessUsage !== null && stats.topProcessUsage !== undefined) {
        ramProcessUsage.textContent = `Memory: ${stats.topProcessUsage.toFixed(1)} MB`;
      } else {
        ramProcessUsage.textContent = 'Memory: --';
      }
      
      ramProcessContainer.style.display = 'block';
    } else {
      ramProcessName.textContent = '--';
      ramProcessUsage.textContent = 'Memory: --';
      ramProcessContainer.style.display = 'none';
    }
  }
}

// Initialize the renderer
document.addEventListener('DOMContentLoaded', () => {
    console.log('WebSpeed renderer initialized');
  console.log('DOM elements check:');
  console.log('  download-speed:', !!document.getElementById('download-speed'));
  console.log('  upload-speed:', !!document.getElementById('upload-speed'));
  console.log('  window.electronAPI:', !!window.electronAPI);
  
  // Initialize Lucide icons immediately
  if (window.lucide) {
    window.lucide.createIcons();
  }
  
  // Load max speed from localStorage
  const maxSpeedInput = document.getElementById('max-speed-input') as HTMLInputElement;
  if (maxSpeedInput) {
      const stored = localStorage.getItem('webspeed-max-speed');
    if (stored) {
      const value = parseFloat(stored);
      if (!isNaN(value) && value > 0) {
        maxSpeedInput.value = value.toString();
      }
    }
    
    // Update progress bars when max speed changes
    maxSpeedInput.addEventListener('input', () => {
      const maxSpeed = getMaxSpeed();
      // Trigger a stats update to recalculate progress bars
      // This will be handled by the next stats update
    });
  }
  
  // Load unit selector from localStorage
  const unitSelect = document.getElementById('unit-select') as HTMLSelectElement;
  if (unitSelect) {
      const stored = localStorage.getItem('webspeed-unit');
    if (stored && ['kbps', 'mbps', 'mbs'].includes(stored)) {
      unitSelect.value = stored;
    }
    
    unitSelect.addEventListener('change', () => {
      // Trigger immediate update with new unit
      if (window.electronAPI && window.electronAPI.requestStatsUpdate) {
        window.electronAPI.requestStatsUpdate();
      }
    });
  }
  
  // Load progress bar visibility preference
  const showProgressCheckbox = document.getElementById('show-progress') as HTMLInputElement;
  if (showProgressCheckbox) {
        const stored = localStorage.getItem('webspeed-show-progress');
    if (stored !== null) {
      showProgressCheckbox.checked = stored === 'true';
    }
    
    showProgressCheckbox.addEventListener('change', () => {
          localStorage.setItem('webspeed-show-progress', showProgressCheckbox.checked.toString());
      // Update visibility immediately
      const downloadProgressContainer = document.getElementById('download-progress-container');
      const uploadProgressContainer = document.getElementById('upload-progress-container');
      if (downloadProgressContainer) {
        downloadProgressContainer.classList.toggle('hidden', !showProgressCheckbox.checked);
      }
      if (uploadProgressContainer) {
        uploadProgressContainer.classList.toggle('hidden', !showProgressCheckbox.checked);
      }
    });
  }
  
  // Load CPU stats visibility preference
  const showCPUCheckbox = document.getElementById('show-cpu') as HTMLInputElement;
  const cpuStatCard = document.getElementById('cpu-stat-card');
  if (showCPUCheckbox && cpuStatCard) {
    const stored = localStorage.getItem('webspeed-show-cpu');
    if (stored !== null) {
      showCPUCheckbox.checked = stored === 'true';
    }
    
    // Set initial visibility
    cpuStatCard.style.display = showCPUCheckbox.checked ? 'flex' : 'none';
    
    showCPUCheckbox.addEventListener('change', () => {
      const isChecked = showCPUCheckbox.checked;
      localStorage.setItem('webspeed-show-cpu', isChecked.toString());
      // Update visibility in stats window immediately
      cpuStatCard.style.display = isChecked ? 'flex' : 'none';
      // Reinitialize Lucide icons when card is shown
      if (isChecked && window.lucide) {
        // Use setTimeout to ensure DOM is updated first
        setTimeout(() => {
          window.lucide?.createIcons();
        }, 10);
      }
      // Update taskbar overlay visibility (it reads from localStorage)
    });
  }
  
  // Load RAM stats visibility preference
  const showRAMCheckbox = document.getElementById('show-ram') as HTMLInputElement;
  const ramStatCard = document.getElementById('ram-stat-card');
  if (showRAMCheckbox && ramStatCard) {
    const stored = localStorage.getItem('webspeed-show-ram');
    if (stored !== null) {
      showRAMCheckbox.checked = stored === 'true';
    } else {
      // Default to showing RAM stats
      showRAMCheckbox.checked = true;
      localStorage.setItem('webspeed-show-ram', 'true');
    }
    
    // Set initial visibility
    ramStatCard.style.display = showRAMCheckbox.checked ? 'flex' : 'none';
    
    showRAMCheckbox.addEventListener('change', () => {
      const isChecked = showRAMCheckbox.checked;
      localStorage.setItem('webspeed-show-ram', isChecked.toString());
      // Update visibility in stats window immediately
      ramStatCard.style.display = isChecked ? 'flex' : 'none';
      // Reinitialize Lucide icons when card is shown
      if (isChecked && window.lucide) {
        // Use setTimeout to ensure DOM is updated first
        setTimeout(() => {
          window.lucide?.createIcons();
        }, 10);
      }
      // Update taskbar overlay visibility (it reads from localStorage)
    });
  }
  
  // Refresh button
  const refreshButton = document.getElementById('refresh-btn');
  if (refreshButton) {
    refreshButton.addEventListener('click', () => {
      // Update progress bar visibility immediately based on checkbox state
      const showProgressCheckbox = document.getElementById('show-progress') as HTMLInputElement;
      const showProgress = showProgressCheckbox?.checked ?? true;
      const downloadProgressContainer = document.getElementById('download-progress-container');
      const uploadProgressContainer = document.getElementById('upload-progress-container');
      if (downloadProgressContainer) {
        if (showProgress) {
          downloadProgressContainer.classList.remove('hidden');
        } else {
          downloadProgressContainer.classList.add('hidden');
        }
      }
      if (uploadProgressContainer) {
        if (showProgress) {
          uploadProgressContainer.classList.remove('hidden');
        } else {
          uploadProgressContainer.classList.add('hidden');
        }
      }
      
      // Request immediate stats update with current settings
      if (window.electronAPI && window.electronAPI.requestStatsUpdate) {
        window.electronAPI.requestStatsUpdate();
      }
      
      // Visual feedback
      refreshButton.textContent = 'Refreshing...';
      setTimeout(() => {
        refreshButton.textContent = 'Refresh';
      }, 500);
    });
  }
  
  // Initialize progress bar visibility on load
  const showProgressCheckboxInit = document.getElementById('show-progress') as HTMLInputElement;
  if (showProgressCheckboxInit) {
    const showProgress = showProgressCheckboxInit.checked;
    const downloadProgressContainer = document.getElementById('download-progress-container');
    const uploadProgressContainer = document.getElementById('upload-progress-container');
    if (downloadProgressContainer) {
      if (showProgress) {
        downloadProgressContainer.classList.remove('hidden');
      } else {
        downloadProgressContainer.classList.add('hidden');
      }
    }
    if (uploadProgressContainer) {
      if (showProgress) {
        uploadProgressContainer.classList.remove('hidden');
      } else {
        uploadProgressContainer.classList.add('hidden');
      }
    }
  }
  
  // Listen for network stats updates from main process
  if (window.electronAPI) {
    console.log('Setting up network stats listener...');
    window.electronAPI.onNetworkStatsUpdate((stats: NetworkStats) => {
      console.log('Received network stats update:', stats);
      updateStats(stats);
    });
    console.log('Network stats listener set up successfully');
    
    // Listen for CPU stats updates from main process
    console.log('Setting up CPU stats listener...');
    window.electronAPI.onCPUStatsUpdate((stats: CPUStats) => {
      console.log('Received CPU stats update:', stats);
      updateCPUStats(stats);
    });
    console.log('CPU stats listener set up successfully');
    
    // Listen for RAM stats updates from main process
    if (window.electronAPI.onRAMStatsUpdate) {
      console.log('Setting up RAM stats listener...');
      window.electronAPI.onRAMStatsUpdate((stats: RAMStats) => {
        console.log('Received RAM stats update:', stats);
        updateRAMStats(stats);
      });
      console.log('RAM stats listener set up successfully');
    }
  } else {
    console.error('window.electronAPI is not available!');
  }
});

