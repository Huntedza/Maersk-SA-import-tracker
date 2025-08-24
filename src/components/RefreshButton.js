// src/components/RefreshButton.js
import React, { useState } from 'react';
import { RefreshCw, Download, ChevronDown } from 'lucide-react';

const RefreshButton = ({ 
  onRefresh, 
  onForceRefresh, 
  isLoading = false, 
  backgroundStatus = null,
  lastRefreshTime = null,
  className = '' 
}) => {
  const [showDropdown, setShowDropdown] = useState(false);

  const formatLastRefresh = (timestamp) => {
    if (!timestamp) return '';
    return `Last updated: ${timestamp.toLocaleTimeString()}`;
  };

  return (
    <div className="relative">
      <div className="flex">
        {/* Main Refresh Button - Fast Cache Refresh */}
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className={`flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-l-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${className}`}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>{isLoading ? 'Refreshing...' : 'Refresh'}</span>
        </button>

        {/* Dropdown Button */}
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          disabled={isLoading}
          className="px-2 py-2 bg-blue-600 text-white border-l border-blue-700 rounded-r-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {/* Dropdown Menu */}
      {showDropdown && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-10">
          <div className="p-2">
            {/* Status Information */}
            <div className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600">
              {backgroundStatus && (
                <div className="flex items-center space-x-2 mb-2">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  <span>{backgroundStatus}</span>
                </div>
              )}
              {lastRefreshTime && (
                <div>{formatLastRefresh(lastRefreshTime)}</div>
              )}
              <div className="text-xs mt-1 text-gray-500 dark:text-gray-500">
                Auto-refresh: Every 30 minutes
              </div>
            </div>

            {/* Force Refresh Option */}
            <button
              onClick={() => {
                setShowDropdown(false);
                onForceRefresh && onForceRefresh();
              }}
              disabled={isLoading}
              className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-4 w-4" />
              <div>
                <div className="font-medium">Force API Refresh</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Fetch latest data from Maersk API (~30-60s)
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Click outside to close dropdown */}
      {showDropdown && (
        <div 
          className="fixed inset-0 z-0" 
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
};

export default RefreshButton;