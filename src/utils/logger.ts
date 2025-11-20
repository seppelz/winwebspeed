// Logger utility - disables logging in production builds
const isProduction = process.env.NODE_ENV === 'production' || require('electron').app?.isPackaged;

export const logger = {
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

