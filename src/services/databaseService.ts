// Database service for the API
import { SensorData } from './apiService';
import axios from 'axios';

// Dynamic API URL that adapts to the environment
let API_BASE_URL = 'http://localhost:3001/api';

// In browser environments, use window location to determine API URL
if (typeof window !== 'undefined') {
  const hostname = window.location.hostname;
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    API_BASE_URL = `http://${hostname}:3001/api`;
  }
}

// Alternative API URLs to try if the main one fails
const ALTERNATIVE_API_URLS = [
  'http://127.0.0.1:3001/api',
  'http://api:3001/api',
  window.location.protocol + '//' + window.location.host + '/api'
];

/**
 * Adds a new sensor reading to the database via API
 * @param reading The sensor reading to add
 * @returns The added sensor reading
 */
export const saveSensorReading = async (reading: SensorData): Promise<SensorData> => {
  // Format data string in the expected format for the API
  const dataString = `pH:${reading.pH.toFixed(2)},temp:${reading.temp.toFixed(2)},water:${reading.water},tds:${reading.tds}`;
  
  try {
    // Try the main API URL first
    try {
      const response = await axios.post(`${API_BASE_URL}/readings`, { data: dataString });
      return response.data;
    } catch (error) {
      // If main URL fails, try alternatives
      for (const url of ALTERNATIVE_API_URLS) {
        try {
          const response = await axios.post(`${url}/readings`, { data: dataString });
          // If successful, update the main URL for future requests
          API_BASE_URL = url;
          return response.data;
        } catch {} // Ignore errors from alternative URLs
      }
      throw error; // If all URLs fail, throw the original error
    }
  } catch (error) {
    console.error('Error saving sensor reading to database:', error);
    throw error;
  }
};

/**
 * Gets the latest sensor reading from the database via API
 * @returns The latest sensor reading or null if none exists
 */
export const getLatestSensorReading = async (): Promise<SensorData | null> => {
  try {
    // Try the main API URL first
    try {
      const response = await axios.get(`${API_BASE_URL}/readings/latest`);
      return response.data;
    } catch (error) {
      // If main URL fails but it's a 404 (no readings), just return null
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      
      // Otherwise, try alternatives
      for (const url of ALTERNATIVE_API_URLS) {
        try {
          const response = await axios.get(`${url}/readings/latest`);
          // If successful, update the main URL for future requests
          API_BASE_URL = url;
          return response.data;
        } catch (altError) {
          // If it's a 404, just return null
          if (axios.isAxiosError(altError) && altError.response?.status === 404) {
            return null;
          }
        }
      }
      throw error; // If all URLs fail, throw the original error
    }
  } catch (error) {
    console.error('Error getting latest sensor reading from database:', error);
    return null;
  }
};

/**
 * Gets all sensor readings from the database via API
 * @returns An array of all sensor readings
 */
export const getAllSensorReadings = async (): Promise<SensorData[]> => {
  try {
    // Try the main API URL first
    try {
      const response = await axios.get(`${API_BASE_URL}/readings`);
      return response.data;
    } catch (error) {
      // If main URL fails, try alternatives
      for (const url of ALTERNATIVE_API_URLS) {
        try {
          const response = await axios.get(`${url}/readings`);
          // If successful, update the main URL for future requests
          API_BASE_URL = url;
          return response.data;
        } catch {} // Ignore errors from alternative URLs
      }
      throw error; // If all URLs fail, throw the original error
    }
  } catch (error) {
    console.error('Error getting all sensor readings from database:', error);
    return [];
  }
};

/**
 * Filters sensor readings based on criteria
 * @param criteria Function that returns true for readings to include
 * @returns Filtered array of sensor readings
 */
export const filterSensorReadings = async (criteria: (reading: SensorData) => boolean): Promise<SensorData[]> => {
  try {
    const allReadings = await getAllSensorReadings();
    return allReadings.filter(criteria);
  } catch (error) {
    console.error('Error filtering sensor readings:', error);
    return [];
  }
};

/**
 * Clears all sensor readings from the database - for testing only
 * @returns Promise that resolves when all readings are cleared
 */
export const clearAllReadings = async (): Promise<void> => {
  // This is intentionally not implemented for the external database
  console.warn('clearAllReadings is not implemented for the external database');
};

/**
 * Gets the database size (number of readings)
 * @returns The number of readings in the database
 */
export const getDatabaseSize = async (): Promise<number> => {
  try {
    const allReadings = await getAllSensorReadings();
    return allReadings.length;
  } catch (error) {
    console.error('Error getting database size:', error);
    return 0;
  }
};
