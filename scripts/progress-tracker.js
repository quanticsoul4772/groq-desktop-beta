/**
 * Progress Tracker Utility
 * Provides progress indicators for long-running operations
 * Supports both TTY and non-TTY environments
 */

const fs = require('fs');
const path = require('path');

class ProgressTracker {
  constructor(options = {}) {
    this.name = options.name || 'Operation';
    this.isTTY = process.stdout.isTTY && !process.env.CI;
    this.verbose = options.verbose || false;
    this.estimatedDuration = options.estimatedDuration || null;
    this.showSpinner = this.isTTY && !options.disableSpinner;
    
    // Spinner frames
    this.spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    this.currentFrame = 0;
    
    // Progress tracking
    this.startTime = null;
    this.lastUpdate = null;
    this.updateInterval = options.updateInterval || 1000; // 1 second
    this.interval = null;
    this.completed = false;
    
    // History for time estimation
    this.historyFile = path.join(process.cwd(), '.pipeline-parity', 'timing-history.json');
    this.history = this.loadHistory();
    
    // Progress messages
    this.progressMessages = [];
    this.currentMessage = '';
    
    // Register cleanup handlers
    this.setupSignalHandlers();
  }

  setupSignalHandlers() {
    const cleanup = () => {
      this.cleanup();
      process.exit(0);
    };
    
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('SIGHUP', cleanup);
  }
  
  cleanup() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    
    if (this.showSpinner && !this.completed) {
      // Clear spinner line and restore cursor
      process.stdout.write('\r\x1b[K');
    }
  }

  loadHistory() {
    try {
      const data = fs.readFileSync(this.historyFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (this.verbose && error.code !== 'ENOENT') {
        console.warn(`Warning: Failed to load timing history: ${error.message}`);
      }
      return {};
    }
  }

  saveHistory(duration) {
    try {
      const history = this.loadHistory();
      if (!history[this.name]) {
        history[this.name] = [];
      }
      
      // Keep last 10 runs for estimation
      history[this.name].push({
        duration,
        timestamp: new Date().toISOString()
      });
      
      if (history[this.name].length > 10) {
        history[this.name] = history[this.name].slice(-10);
      }
      
      // Ensure directory exists with proper error handling
      const dir = path.dirname(this.historyFile);
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (mkdirError) {
        if (mkdirError.code !== 'EEXIST') {
          throw mkdirError;
        }
      }
      
      fs.writeFileSync(this.historyFile, JSON.stringify(history, null, 2));
    } catch (error) {
      if (this.verbose) {
        console.warn(`Warning: Failed to save timing history: ${error.message}`);
      }
    }
  }

  getEstimatedDuration() {
    if (this.estimatedDuration) {
      return this.estimatedDuration;
    }
    
    const operationHistory = this.history[this.name];
    if (operationHistory && operationHistory.length > 0) {
      // Use average of last 3 runs, or all if less than 3
      const recentRuns = operationHistory.slice(-3);
      const avgDuration = recentRuns.reduce((sum, run) => sum + run.duration, 0) / recentRuns.length;
      return Math.round(avgDuration);
    }
    
    return null;
  }

  formatTime(seconds) {
    if (seconds < 60) {
      return `${seconds}s`;
    } else {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds}s`;
    }
  }

  getProgressMessage() {
    if (!this.startTime) return '';
    
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const estimated = this.getEstimatedDuration();
    
    let message = `${this.name} - ${this.formatTime(elapsed)}`;
    
    if (estimated && estimated > 5) {
      const remaining = Math.max(0, estimated - elapsed);
      const progress = Math.min(100, Math.floor((elapsed / estimated) * 100));
      
      if (remaining > 0) {
        message += ` (~${this.formatTime(remaining)} remaining, ${progress}%)`;
      } else {
        message += ` (${progress}%)`;
      }
    }
    
    if (this.currentMessage) {
      message += ` - ${this.currentMessage}`;
    }
    
    return message;
  }

  start() {
    this.startTime = Date.now();
    this.lastUpdate = this.startTime;
    this.completed = false;
    
    try {
      if (this.showSpinner) {
        // Clear any existing interval
        if (this.interval) {
          clearInterval(this.interval);
          this.interval = null;
        }
        
        this.interval = setInterval(() => {
          this.updateSpinner();
        }, 100); // Update spinner every 100ms
      } else {
        // For non-TTY, show periodic updates
        this.log(`Starting ${this.name}...`);
        
        this.interval = setInterval(() => {
          this.log(this.getProgressMessage());
        }, this.updateInterval);
      }
    } catch (error) {
      // Clean up on error
      this.cleanup();
      throw error;
    }
  }

  updateSpinner() {
    if (!this.showSpinner || this.completed) return;
    
    const frame = this.spinnerFrames[this.currentFrame];
    const message = this.getProgressMessage();
    
    // Clear the line and write new content
    process.stdout.write(`\r${frame} ${message}`);
    
    this.currentFrame = (this.currentFrame + 1) % this.spinnerFrames.length;
  }

  updateMessage(message) {
    this.currentMessage = message;
    
    if (this.verbose && !this.showSpinner) {
      this.log(`${this.name}: ${message}`);
    }
  }

  log(message, force = false) {
    // Only log if verbose mode is on, or if forced, or if not using spinner
    if (this.verbose || force || !this.showSpinner) {
      if (this.showSpinner) {
        // Clear spinner line before logging
        process.stdout.write('\r\x1b[K');
      }
      console.log(`[${new Date().toISOString().split('T')[1].substring(0, 8)}] ${message}`);
    }
  }

  complete(success = true, finalMessage = null) {
    this.completed = true;
    
    // Always clean up resources
    this.cleanup();
    
    const duration = Math.floor((Date.now() - this.startTime) / 1000);
    
    const status = success ? '✅' : '❌';
    const statusText = success ? 'completed' : 'failed';
    const message = finalMessage || `${this.name} ${statusText} in ${this.formatTime(duration)}`;
    
    console.log(`${status} ${message}`);
    
    if (success) {
      this.saveHistory(duration);
    }
    
    return duration;
  }

  // Static method to create and run a progress-tracked operation
  static async track(name, operation, options = {}) {
    const tracker = new ProgressTracker({ name, ...options });
    
    try {
      tracker.start();
      const result = await operation(tracker);
      tracker.complete(true);
      return result;
    } catch (error) {
      tracker.complete(false, `${name} failed: ${error.message}`);
      throw error;
    }
  }

  // Utility to wrap execSync with progress tracking
  static execWithProgress(command, options = {}) {
    const { execSync } = require('child_process');
    const { name = 'Command', ...execOptions } = options;
    
    return ProgressTracker.track(name, (tracker) => {
      tracker.updateMessage(`Running: ${command}`);
      return execSync(command, {
        encoding: 'utf8',
        stdio: tracker.verbose ? 'inherit' : ['pipe', 'pipe', 'pipe'],
        ...execOptions
      });
    }, { name, ...options });
  }
}

module.exports = ProgressTracker;