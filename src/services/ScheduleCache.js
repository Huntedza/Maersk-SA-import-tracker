// A simple in-memory cache for the Node.js test environment.
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

class ScheduleCache {
  static getCache(serviceName) {
    const cachedItem = this.cache.get(serviceName);
    if (!cachedItem) {
      return null;
    }

    const now = new Date().getTime();
    if (now - cachedItem.timestamp > CACHE_DURATION) {
      this.cache.delete(serviceName);
      return null;
    }
    return cachedItem.data;
  }

  static setCache(serviceName, scheduleData) {
    this.cache.set(serviceName, {
      data: scheduleData,
      timestamp: new Date().getTime(),
    });
  }

  static isCacheValid(serviceName) {
    const cachedItem = this.cache.get(serviceName);
    if (!cachedItem) {
      return false;
    }
    const now = new Date().getTime();
    return (now - cachedItem.timestamp) <= CACHE_DURATION;
  }

  static clearCache(serviceName) {
    this.cache.delete(serviceName);
  }

  static clear() {
    this.cache.clear();
  }
}

ScheduleCache.cache = new Map();

export { ScheduleCache };