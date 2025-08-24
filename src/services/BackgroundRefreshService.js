// BackgroundRefreshService.js - Handles automatic background data refresh
import { DatabaseService } from './DatabaseService';

class BackgroundRefreshService {
  constructor() {
    this.intervalId = null;
    this.isRefreshing = false;
    this.lastRefresh = null;
    this.refreshInterval = 30 * 60 * 1000; // 30 minutes in milliseconds
    this.listeners = [];
  }

  // Add listener for refresh events
  addListener(callback) {
    this.listeners.push(callback);
  }

  // Remove listener
  removeListener(callback) {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  // Notify all listeners of refresh events
  notifyListeners(event, data) {
    this.listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        console.error('Error in background refresh listener:', error);
      }
    });
  }

  // Start the background refresh timer
  start() {
    if (this.intervalId) {
      console.log('Background refresh already running');
      return;
    }

    console.log('🔄 Starting background refresh service (30 min intervals)');
    
    // Run immediately if no recent data
    this.checkAndRefresh();
    
    // Set up recurring refresh
    this.intervalId = setInterval(() => {
      this.checkAndRefresh();
    }, this.refreshInterval);
  }

  // Stop the background refresh timer
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 Stopped background refresh service');
    }
  }

  // Check if refresh is needed and perform it
  async checkAndRefresh() {
    if (this.isRefreshing) {
      console.log('⏳ Background refresh already in progress, skipping...');
      return;
    }

    try {
      this.isRefreshing = true;
      this.notifyListeners('refresh_started', { timestamp: new Date() });

      console.log('🔄 Background refresh: Checking for updates...');

      // Dynamic import to avoid circular dependencies
      const { fetchSAInboundSchedules } = await import('./SAInboundApi');
      
      // Fetch fresh data from API
      const freshData = await fetchSAInboundSchedules();
      
      if (freshData) {
        // Save to database
        await DatabaseService.saveSchedules(freshData);
        
        this.lastRefresh = new Date();
        console.log('✅ Background refresh completed:', this.lastRefresh.toLocaleTimeString());
        
        this.notifyListeners('refresh_completed', { 
          timestamp: this.lastRefresh,
          vesselCount: freshData.current?.vessels?.length || 0
        });
      } else {
        console.log('⚠️ Background refresh failed - no data received');
        this.notifyListeners('refresh_failed', { timestamp: new Date() });
      }

    } catch (error) {
      console.error('❌ Background refresh error:', error);
      this.notifyListeners('refresh_error', { error, timestamp: new Date() });
    } finally {
      this.isRefreshing = false;
    }
  }

  // Force an immediate refresh
  async forceRefresh() {
    if (this.isRefreshing) {
      console.log('⏳ Background refresh already in progress');
      return false;
    }
    
    console.log('🚀 Force refresh requested');
    await this.checkAndRefresh();
    return true;
  }

  // Get refresh status
  getStatus() {
    return {
      isRunning: !!this.intervalId,
      isRefreshing: this.isRefreshing,
      lastRefresh: this.lastRefresh,
      nextRefresh: this.lastRefresh ? new Date(this.lastRefresh.getTime() + this.refreshInterval) : null
    };
  }

  // Get time until next refresh
  getTimeUntilNextRefresh() {
    if (!this.lastRefresh) return 'Unknown';
    
    const nextRefresh = new Date(this.lastRefresh.getTime() + this.refreshInterval);
    const now = new Date();
    const msUntilNext = nextRefresh.getTime() - now.getTime();
    
    if (msUntilNext <= 0) return 'Soon';
    
    const minutes = Math.floor(msUntilNext / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  }
}

// Create singleton instance
export const backgroundRefreshService = new BackgroundRefreshService();

// Auto-start the service when imported
if (typeof window !== 'undefined') {
  // Only start in browser environment
  backgroundRefreshService.start();
}

export default backgroundRefreshService;