// DatabaseService.js - Handles communication with the local backend server

const API_BASE_URL = 'http://localhost:3002/api';

// Save vessel schedules to the database via the server
const saveSchedules = async (scheduleData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/schedules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(scheduleData),
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }

    console.log('Schedule data saved via server.');
    return true;
  } catch (error) {
    console.error('Error saving schedule data via server:', error);
    return false;
  }
};

// Get the latest schedule data from the server
const getLatestSchedules = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/schedules`);
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error retrieving schedule data from server:', error);
    return null;
  }
};

// Clear all schedule data via the server
const clearOldSchedules = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/schedules`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }

    console.log('Cleared all schedule data via server.');
    return true;
  } catch (error) {
    console.error('Error clearing schedule data via server:', error);
    return false;
  }
};

export const DatabaseService = {
  saveSchedules,
  getLatestSchedules,
  clearOldSchedules,
};
