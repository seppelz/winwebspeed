import * as si from 'systeminformation';
import { CPUStats, RAMStats, SystemStats } from '../types';
import { logger } from '../utils/logger';

export class CPUMonitor {
  private updateInterval: NodeJS.Timeout | null = null;
  private callback: (stats: CPUStats) => void;
  private ramCallback: ((stats: RAMStats) => void) | null = null;
  private systemCallback: ((stats: SystemStats) => void) | null = null;
  private isRunning: boolean = false;

  constructor(callback: (stats: CPUStats) => void, ramCallback?: (stats: RAMStats) => void, systemCallback?: (stats: SystemStats) => void) {
    this.callback = callback;
    this.ramCallback = ramCallback || null;
    this.systemCallback = systemCallback || null;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    // Make an initial baseline call to currentLoad() for accurate measurements
    // The first call establishes a baseline, subsequent calls will be more accurate
    try {
      await si.currentLoad().catch(() => null);
      // Wait a short moment for the baseline to be established
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      logger.error('Error establishing CPU baseline:', error);
    }
    
    // Get initial stats after baseline is established
    await this.updateStats();
    
    // Start monitoring loop
    this.updateInterval = setInterval(async () => {
      await this.updateStats();
    }, 1000); // Update every 1 second for more responsive updates
  }

  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.isRunning = false;
  }

  private async updateStats(): Promise<void> {
    try {
      // Get CPU usage, temperature, memory, and processes
      const [cpuUsage, cpuTemp, memInfo, processes] = await Promise.all([
        si.currentLoad().catch(() => null),
        si.cpuTemperature().catch(() => null), // Temperature might not be available on all systems
        si.mem().catch(() => null), // Get memory information
        si.processes().catch(() => null) // Get process list
      ]);

      // Get CPU usage percentage
      // Use currentLoadUser + currentLoadSystem to match Task Manager more closely
      // Task Manager shows user + system CPU time, excluding I/O wait and other factors
      let usage: number | null = null;
      if (cpuUsage) {
        const userLoad = cpuUsage.currentLoadUser || 0;
        const systemLoad = cpuUsage.currentLoadSystem || 0;
        const totalLoad = userLoad + systemLoad;
        
        // Cap at 100% to avoid any calculation errors
        if (totalLoad >= 0 && totalLoad <= 100) {
          usage = Math.round(totalLoad * 10) / 10; // Round to 1 decimal place
        } else if (cpuUsage.currentLoad !== null && cpuUsage.currentLoad !== undefined) {
          // Fallback to currentLoad if the calculation seems off
          usage = Math.round(cpuUsage.currentLoad * 10) / 10;
        }
      }
      
      // Get CPU temperature (in Celsius)
      // Try multiple sources: main, cores, max, socket, chipset
      let temperature: number | null = null;
      if (cpuTemp) {
        const cpuTempAny = cpuTemp as any;
        
        // Try main temperature first
        if (cpuTemp.main !== null && cpuTemp.main !== undefined && cpuTemp.main > 0) {
          temperature = Math.round(cpuTemp.main * 10) / 10;
          logger.debug('Using CPU temperature from main:', temperature);
        }
        // If main is not available, try max temperature
        else if (cpuTemp.max !== null && cpuTemp.max !== undefined && cpuTemp.max > 0) {
          temperature = Math.round(cpuTemp.max * 10) / 10;
          logger.debug('Using CPU temperature from max:', temperature);
        }
        // Try cores array (get highest core temperature)
        else if (cpuTemp.cores && Array.isArray(cpuTemp.cores) && cpuTemp.cores.length > 0) {
          const validTemps = cpuTemp.cores.filter((t: number) => t !== null && t !== undefined && t > 0);
          if (validTemps.length > 0) {
            const maxCoreTemp = Math.max(...validTemps);
            temperature = Math.round(maxCoreTemp * 10) / 10;
            logger.debug('Using CPU temperature from cores:', temperature);
          }
        }
        // Try socket temperatures (some AMD systems expose this)
        else if (cpuTempAny.socket && Array.isArray(cpuTempAny.socket) && cpuTempAny.socket.length > 0) {
          const validTemps = cpuTempAny.socket.filter((t: number) => t !== null && t !== undefined && t > 0);
          if (validTemps.length > 0) {
            const maxSocketTemp = Math.max(...validTemps);
            temperature = Math.round(maxSocketTemp * 10) / 10;
            logger.debug('Using CPU temperature from socket:', temperature);
          }
        }
        // Try chipset temperature (some systems expose this)
        else if (cpuTempAny.chipset !== null && cpuTempAny.chipset !== undefined && cpuTempAny.chipset > 0) {
          temperature = Math.round(cpuTempAny.chipset * 10) / 10;
          logger.debug('Using CPU temperature from chipset:', temperature);
        }
        
        // Log for debugging if temperature is still null
        if (temperature === null) {
          logger.debug('CPU temperature not available. Raw data:', JSON.stringify(cpuTemp));
          logger.debug('This may require:');
          logger.debug('1. Running the app as Administrator');
          logger.debug('2. Proper AMD chipset drivers installed');
          logger.debug('3. Hardware sensor support on your ThinkPad model');
        }
      } else {
        logger.debug('CPU temperature API returned null/undefined - check if systeminformation can access sensors');
      }
      
      // Get system temperature - use CPU temperature as system temperature
      // For most systems, CPU temperature is the best indicator of system temperature
      // On laptops, this represents the overall system thermal state
      let systemTemperature: number | null = temperature;

      // Find top CPU process
      let topProcess: string | null = null;
      let topProcessUsage: number | null = null;
      if (processes && processes.list && processes.list.length > 0) {
        // Sort processes by CPU usage (descending), excluding System Idle Process
        const sortedProcesses = processes.list
          .filter((p: any) => {
            // Filter out processes with no CPU usage
            if (p.cpu === null || p.cpu === undefined || p.cpu <= 0) {
              return false;
            }
            // Filter out System Idle Process (case-insensitive)
            const processName = (p.name || p.command || '').toLowerCase();
            return !processName.includes('system idle') && 
                   !processName.includes('idle process') &&
                   processName !== 'idle';
          })
          .sort((a: any, b: any) => (b.cpu || 0) - (a.cpu || 0));
        
        if (sortedProcesses.length > 0) {
          const topProc = sortedProcesses[0];
          let processName = topProc.name || topProc.command || 'Unknown';
          
          // Get the CPU usage percentage of the top process
          if (topProc.cpu !== null && topProc.cpu !== undefined) {
            topProcessUsage = Math.round(topProc.cpu * 10) / 10; // Round to 1 decimal place
          }
          
          // For Chromium-based browsers, try to get the actual browser name from the path or command
          // This helps identify Helium, Edge, Brave, etc. instead of showing "Chrome"
          if (processName.toLowerCase().includes('chrome')) {
            const path = (topProc.path || '').toLowerCase();
            const command = (topProc.command || '').toLowerCase();
            const searchText = path + ' ' + command;
            
            // Check for common Chromium-based browsers in the path or command
            if (searchText.includes('helium')) {
              processName = 'Helium';
            } else if (searchText.includes('msedge') || searchText.includes('microsoft edge')) {
              processName = 'Edge';
            } else if (searchText.includes('brave')) {
              processName = 'Brave';
            } else if (searchText.includes('opera')) {
              processName = 'Opera';
            } else if (searchText.includes('vivaldi')) {
              processName = 'Vivaldi';
            } else if (searchText.includes('chromium')) {
              processName = 'Chromium';
            }
            // If no specific browser found, keep "Chrome" as default
          } else {
            // Remove file extension on Windows (e.g., "chrome.exe" -> "chrome")
            if (processName.endsWith('.exe')) {
              processName = processName.substring(0, processName.length - 4);
            }
          }
          
          // Format: first 15 characters + "..." if longer
          if (processName.length > 15) {
            topProcess = processName.substring(0, 15) + '...';
          } else {
            topProcess = processName;
          }
        }
      }

      this.callback({
        usage,
        temperature,
        topProcess,
        topProcessUsage
      });
      
      // Send system stats (temperature only)
      if (this.systemCallback) {
        this.systemCallback({
          temperature: systemTemperature
        });
      }

      // Get RAM usage and top memory process
      if (this.ramCallback) {
        let ramUsage: number | null = null;
        let topMemoryProcess: string | null = null;
        let topMemoryUsage: number | null = null;

        // Calculate RAM usage percentage
        if (memInfo && memInfo.total && memInfo.used !== null && memInfo.used !== undefined) {
          const usedMB = memInfo.used / (1024 * 1024); // Convert bytes to MB
          const totalMB = memInfo.total / (1024 * 1024);
          ramUsage = Math.round((memInfo.used / memInfo.total) * 100 * 10) / 10; // Round to 1 decimal place
        }

        // Find top memory-consuming process
        if (processes && processes.list && processes.list.length > 0 && memInfo && memInfo.total) {
          const totalMemoryMB = memInfo.total / (1024 * 1024); // Total memory in MB
          
          // Sort processes by memory usage (descending), excluding system memory management processes
          const sortedMemoryProcesses = processes.list
            .filter((p: any) => {
              // Filter out processes with no memory usage
              if (p.mem === null || p.mem === undefined || p.mem <= 0) {
                return false;
              }
              // Filter out Memory Compress and other Windows memory management processes (case-insensitive)
              const processName = (p.name || p.command || '').toLowerCase();
              return !processName.includes('memory compress') &&
                     !processName.includes('memorycompression') &&
                     !processName.includes('memory compression') &&
                     processName !== 'memcompression';
            })
            .sort((a: any, b: any) => (b.mem || 0) - (a.mem || 0));
          
          if (sortedMemoryProcesses.length > 0) {
            const topMemProc = sortedMemoryProcesses[0];
            let processName = topMemProc.name || topMemProc.command || 'Unknown';
            
            // Get the memory usage in MB of the top process
            // p.mem is memory usage percentage, calculate MB from total memory
            if (topMemProc.mem !== null && topMemProc.mem !== undefined) {
              const memoryMB = (topMemProc.mem / 100) * totalMemoryMB;
              topMemoryUsage = Math.round(memoryMB * 10) / 10; // Round to 1 decimal place
            }
            
            // For Chromium-based browsers, try to get the actual browser name from the path or command
            if (processName.toLowerCase().includes('chrome')) {
              const path = (topMemProc.path || '').toLowerCase();
              const command = (topMemProc.command || '').toLowerCase();
              const searchText = path + ' ' + command;
              
              // Check for common Chromium-based browsers in the path or command
              if (searchText.includes('helium')) {
                processName = 'Helium';
              } else if (searchText.includes('msedge') || searchText.includes('microsoft edge')) {
                processName = 'Edge';
              } else if (searchText.includes('brave')) {
                processName = 'Brave';
              } else if (searchText.includes('opera')) {
                processName = 'Opera';
              } else if (searchText.includes('vivaldi')) {
                processName = 'Vivaldi';
              } else if (searchText.includes('chromium')) {
                processName = 'Chromium';
              }
            } else {
              // Remove file extension on Windows (e.g., "chrome.exe" -> "chrome")
              if (processName.endsWith('.exe')) {
                processName = processName.substring(0, processName.length - 4);
              }
            }
            
            // Format: first 15 characters + "..." if longer
            if (processName.length > 15) {
              topMemoryProcess = processName.substring(0, 15) + '...';
            } else {
              topMemoryProcess = processName;
            }
          }
        }

        this.ramCallback({
          usage: ramUsage,
          topProcess: topMemoryProcess,
          topProcessUsage: topMemoryUsage
        });
      }
    } catch (error) {
      logger.error('Error updating CPU stats:', error);
      // Send null values on error
      this.callback({
        usage: null,
        temperature: null,
        topProcess: null,
        topProcessUsage: null
      });
      
      if (this.ramCallback) {
        this.ramCallback({
          usage: null,
          topProcess: null,
          topProcessUsage: null
        });
      }
      
      if (this.systemCallback) {
        this.systemCallback({
          temperature: null
        });
      }
    }
  }
}

