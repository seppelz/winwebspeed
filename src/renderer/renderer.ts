// Renderer script
export {};

// Browser-compatible logger - disables logging in production builds
// Check if we're in a packaged Electron app (production)
const isProduction = (() => {
  try {
    // In Electron renderer, we can check if we're packaged
    return !!(window as any).__ELECTRON_IS_PACKAGED__ || 
           !location.href.includes('file://') || 
           location.href.includes('app.asar');
  } catch {
    return false;
  }
})();

const logger = {
  log: (...args: any[]): void => {
    if (!isProduction) {
      console.log(...args);
    }
  },
  
  error: (...args: any[]): void => {
    // Always log errors, even in production
    console.error(...args);
  },
  
  warn: (...args: any[]): void => {
    if (!isProduction) {
      console.warn(...args);
    }
  },
  
  debug: (...args: any[]): void => {
    if (!isProduction) {
      console.debug(...args);
    }
  }
};

// Declare the electronAPI type
declare global {
  interface Window {
    electronAPI: {
      onNetworkStatsUpdate: (callback: (stats: NetworkStats) => void) => void;
      onCPUStatsUpdate: (callback: (stats: CPUStats) => void) => void;
      onRAMStatsUpdate: (callback: (stats: RAMStats) => void) => void;
      onSystemStatsUpdate: (callback: (stats: SystemStats) => void) => void;
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

interface SystemStats {
  temperature: number | null; // System temperature in Celsius (from sensors)
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

// Validate and sanitize max speed input
function validateMaxSpeed(value: number): number {
  // Ensure value is a valid number, positive, and within reasonable bounds (1-10000 Mbit/s)
  if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
    return 100; // Default
  }
  if (value <= 0) {
    return 1; // Minimum
  }
  if (value > 10000) {
    return 10000; // Maximum
  }
  // Round to 2 decimal places to prevent precision issues
  return Math.round(value * 100) / 100;
}

// Get max speed from input or localStorage
function getMaxSpeed(): number {
  const input = document.getElementById('max-speed-input') as HTMLInputElement;
  if (input) {
    const value = parseFloat(input.value);
    const validated = validateMaxSpeed(value);
    
    // If value was invalid, update the input field
    if (validated !== value) {
      input.value = validated.toString();
    }
    
    // Store validated value
    localStorage.setItem('webspeed-max-speed', validated.toString());
    return validated;
  }
  // Try to get from localStorage
  const stored = localStorage.getItem('webspeed-max-speed');
  if (stored) {
    const value = parseFloat(stored);
    const validated = validateMaxSpeed(value);
    if (validated !== value) {
      // Update localStorage with validated value
      localStorage.setItem('webspeed-max-speed', validated.toString());
    }
    return validated;
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

// Validate unit value
function validateUnit(unit: string): 'kbps' | 'mbps' | 'mbs' {
  // Only allow specific unit values
  if (unit === 'kbps' || unit === 'mbps' || unit === 'mbs') {
    return unit;
  }
  return 'mbps'; // Default to Mbit/s if invalid
}

// Get selected unit
function getSelectedUnit(): string {
  const unitSelect = document.getElementById('unit-select') as HTMLSelectElement;
  if (unitSelect) {
    const unit = validateUnit(unitSelect.value);
    // If unit was invalid, update the select
    if (unit !== unitSelect.value) {
      unitSelect.value = unit;
    }
    localStorage.setItem('webspeed-unit', unit);
    return unit;
  }
  // Try to get from localStorage
  const stored = localStorage.getItem('webspeed-unit');
  if (stored) {
    const validated = validateUnit(stored);
    if (validated !== stored) {
      // Update localStorage with validated value
      localStorage.setItem('webspeed-unit', validated);
    }
    return validated;
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
  
  // Update CPU temperature (only if enabled and available)
  const cpuTempElement = document.getElementById('cpu-temperature');
  const cpuTempContainer = document.getElementById('cpu-temp-container');
  const showCPUTempCheckbox = document.getElementById('show-cpu-temp') as HTMLInputElement;
  const showCPUTemp = showCPUTempCheckbox?.checked ?? false;
  const showCPUCheckbox = document.getElementById('show-cpu') as HTMLInputElement;
  const showCPU = showCPUCheckbox?.checked ?? false;
  
  // Only show temperature if both CPU stats and temperature are enabled
  if (cpuTempElement && cpuTempContainer) {
    // Only update display if both CPU stats and temperature are enabled
    if (showCPUTemp && showCPU) {
      // Container should already be visible from checkbox handler, but ensure it's visible
      cpuTempContainer.style.display = 'block';
      
      // Update the value if data is available
      if (stats.temperature !== null && stats.temperature !== undefined) {
        cpuTempElement.textContent = stats.temperature.toFixed(1);
        cpuTempElement.classList.add('updating');
        setTimeout(() => {
          cpuTempElement.classList.remove('updating');
        }, 500);
      } else {
        // Show placeholder if data isn't available yet
        cpuTempElement.textContent = '--';
      }
    } else {
      // Hide if either CPU stats or temperature toggle is disabled
      cpuTempContainer.style.display = 'none';
      cpuTempElement.textContent = '--';
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

function updateSystemStats(stats: SystemStats): void {
  // Update system temperature
  const systemTempElement = document.getElementById('system-temperature');
  if (systemTempElement) {
    if (stats.temperature !== null && stats.temperature !== undefined) {
      systemTempElement.textContent = stats.temperature.toFixed(1);
      systemTempElement.classList.add('updating');
      setTimeout(() => {
        systemTempElement.classList.remove('updating');
      }, 500);
    } else {
      systemTempElement.textContent = '--';
    }
  }
}

// Initialize the renderer
document.addEventListener('DOMContentLoaded', () => {
  logger.log('WebSpeed renderer initialized');
  logger.debug('DOM elements check:');
  logger.debug('  download-speed:', !!document.getElementById('download-speed'));
  logger.debug('  upload-speed:', !!document.getElementById('upload-speed'));
  logger.debug('  window.electronAPI:', !!window.electronAPI);
  
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
    
    // Update progress bars when max speed changes with validation
    maxSpeedInput.addEventListener('input', () => {
      const value = parseFloat(maxSpeedInput.value);
      const validated = validateMaxSpeed(value);
      
      // If value was invalid, update the input field immediately
      if (validated !== value || isNaN(value)) {
        maxSpeedInput.value = validated.toString();
      }
      
      const maxSpeed = getMaxSpeed();
      // Trigger a stats update to recalculate progress bars
      if (window.electronAPI && window.electronAPI.requestStatsUpdate) {
        window.electronAPI.requestStatsUpdate();
      }
    });
    
    // Validate on blur as well
    maxSpeedInput.addEventListener('blur', () => {
      const value = parseFloat(maxSpeedInput.value);
      const validated = validateMaxSpeed(value);
      if (validated !== value || isNaN(value)) {
        maxSpeedInput.value = validated.toString();
        localStorage.setItem('webspeed-max-speed', validated.toString());
      }
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
      // Validate unit on change
      const validated = validateUnit(unitSelect.value);
      if (validated !== unitSelect.value) {
        unitSelect.value = validated;
      }
      localStorage.setItem('webspeed-unit', validated);
      
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
      // Request stats update to refresh display
      if (window.electronAPI && window.electronAPI.requestStatsUpdate) {
        window.electronAPI.requestStatsUpdate();
      }
      // Update taskbar overlay visibility (it reads from localStorage)
    });
  }
  
  // Load CPU temperature visibility preference
  const showCPUTempCheckbox = document.getElementById('show-cpu-temp') as HTMLInputElement;
  const cpuTempContainer = document.getElementById('cpu-temp-container');
  if (showCPUTempCheckbox && cpuTempContainer) {
    const stored = localStorage.getItem('webspeed-show-cpu-temp');
    if (stored !== null) {
      showCPUTempCheckbox.checked = stored === 'true';
    } else {
      // Default to false (hidden)
      showCPUTempCheckbox.checked = false;
      localStorage.setItem('webspeed-show-cpu-temp', 'false');
    }
    
    // Set initial visibility
    cpuTempContainer.style.display = showCPUTempCheckbox.checked ? 'block' : 'none';
    
    showCPUTempCheckbox.addEventListener('change', () => {
      const isChecked = showCPUTempCheckbox.checked;
      localStorage.setItem('webspeed-show-cpu-temp', isChecked.toString());
      // Update visibility in stats window immediately
      // Always show container when enabled, even if data isn't available yet
      if (isChecked) {
        cpuTempContainer.style.display = 'block';
      } else {
        cpuTempContainer.style.display = 'none';
      }
      // Trigger stats update to refresh temperature display
      if (window.electronAPI && window.electronAPI.requestStatsUpdate) {
        window.electronAPI.requestStatsUpdate();
      }
      // Update taskbar overlay visibility (it reads from localStorage)
    });
  }
  
  // Load System stats visibility preference
  const showSystemCheckbox = document.getElementById('show-system') as HTMLInputElement;
  const systemStatCard = document.getElementById('system-stat-card');
  if (showSystemCheckbox && systemStatCard) {
    const stored = localStorage.getItem('webspeed-show-system');
    if (stored !== null) {
      showSystemCheckbox.checked = stored === 'true';
    } else {
      // Default to false (hidden)
      showSystemCheckbox.checked = false;
      localStorage.setItem('webspeed-show-system', 'false');
    }
    
    // Set initial visibility
    systemStatCard.style.display = showSystemCheckbox.checked ? 'flex' : 'none';
    
    showSystemCheckbox.addEventListener('change', () => {
      const isChecked = showSystemCheckbox.checked;
      localStorage.setItem('webspeed-show-system', isChecked.toString());
      // Update visibility in stats window immediately
      systemStatCard.style.display = isChecked ? 'flex' : 'none';
      // Reinitialize Lucide icons when card is shown
      if (isChecked && window.lucide) {
        setTimeout(() => {
          window.lucide?.createIcons();
        }, 10);
      }
      // Request stats update to refresh display
      if (window.electronAPI && window.electronAPI.requestStatsUpdate) {
        window.electronAPI.requestStatsUpdate();
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
      // Request stats update to refresh display
      if (window.electronAPI && window.electronAPI.requestStatsUpdate) {
        window.electronAPI.requestStatsUpdate();
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
    logger.log('Setting up network stats listener...');
    window.electronAPI.onNetworkStatsUpdate((stats: NetworkStats) => {
      logger.debug('Received network stats update:', stats);
      updateStats(stats);
    });
    logger.log('Network stats listener set up successfully');
    
    // Listen for CPU stats updates from main process
    logger.log('Setting up CPU stats listener...');
    window.electronAPI.onCPUStatsUpdate((stats: CPUStats) => {
      logger.debug('Received CPU stats update:', stats);
      updateCPUStats(stats);
    });
    logger.log('CPU stats listener set up successfully');
    
    // Listen for RAM stats updates from main process
    if (window.electronAPI.onRAMStatsUpdate) {
      logger.log('Setting up RAM stats listener...');
      window.electronAPI.onRAMStatsUpdate((stats: RAMStats) => {
        logger.debug('Received RAM stats update:', stats);
        updateRAMStats(stats);
      });
      logger.log('RAM stats listener set up successfully');
    }
    
    // Listen for System stats updates from main process
    if (window.electronAPI.onSystemStatsUpdate) {
      logger.log('Setting up System stats listener...');
      window.electronAPI.onSystemStatsUpdate((stats: SystemStats) => {
        logger.debug('Received System stats update:', stats);
        updateSystemStats(stats);
      });
      logger.log('System stats listener set up successfully');
    }
    
    // Request initial stats to populate the UI
    if (window.electronAPI.requestStatsUpdate) {
      setTimeout(() => {
        window.electronAPI.requestStatsUpdate?.();
      }, 500); // Wait a bit for everything to initialize
    }
  } else {
    logger.error('window.electronAPI is not available!');
  }
});

