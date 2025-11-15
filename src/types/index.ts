export interface NetworkStats {
  downloadSpeed: number; // in kbps
  uploadSpeed: number; // in kbps
  downloadBytes: number;
  uploadBytes: number;
  interfaceName: string;
  interfaceType: 'WiFi' | 'Ethernet' | 'Unknown';
  monitoringStartTime?: number; // Timestamp when monitoring started (optional)
}

export interface NetworkInterface {
  name: string;
  bytesReceived: number;
  bytesSent: number;
  type: 'WiFi' | 'Ethernet' | 'Unknown';
}

export interface CPUStats {
  usage: number | null; // CPU usage percentage (0-100)
  temperature: number | null; // CPU temperature in Celsius
  topProcess: string | null; // Name of the process using most CPU (first 15 chars + ...), excludes System Idle Process
  topProcessUsage: number | null; // CPU usage percentage of the top process (0-100)
}

export interface RAMStats {
  usage: number | null; // RAM usage percentage (0-100)
  topProcess: string | null; // Name of the process using most RAM (first 15 chars + ...)
  topProcessUsage: number | null; // RAM usage in MB of the top process
}


