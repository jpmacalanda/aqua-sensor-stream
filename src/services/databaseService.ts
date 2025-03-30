// Database service for the API
import { SensorData } from './apiService';

// In-memory database (simulating a database)
let sensorReadings: SensorData[] = [];

/**
 * Adds a new sensor reading to the database
 * @param reading The sensor reading to add
 * @returns The added sensor reading
 */
export const saveSensorReading = (reading: SensorData): SensorData => {
  sensorReadings.push(reading);
  
  // Keep only the most recent 100 readings
  if (sensorReadings.length > 100) {
    sensorReadings = sensorReadings.slice(-100);
  }
  
  return reading;
};

/**
 * Gets the latest sensor reading from the database
 * @returns The latest sensor reading or null if none exists
 */
export const getLatestReading = (): SensorData | null => {
  if (sensorReadings.length === 0) return null;
  return sensorReadings[sensorReadings.length - 1];
};

/**
 * Gets all sensor readings from the database
 * @returns An array of all sensor readings
 */
export const getAllReadings = (): SensorData[] => {
  return [...sensorReadings];
};

/**
 * Clears all sensor readings from the database
 */
export const clearAllReadings = (): void => {
  sensorReadings = [];
};

/**
 * Gets the database size (number of readings)
 * @returns The number of readings in the database
 */
export const getDatabaseSize = (): number => {
  return sensorReadings.length;
};
