
// This file simulates a RESTful API service that would interact with Arduino data
import { 
  saveSensorReading, 
  getLatestSensorReading, 
  getAllSensorReadings 
} from './databaseService';

export interface SensorData {
  pH: number;
  temp: number;
  water: string;
  tds: number;
  timestamp: number;
}

// Function to parse the raw data string from Arduino
export const parseArduinoData = (dataString: string): SensorData | null => {
  try {
    // Sample format: pH:6.20,temp:23.20,water:medium,tds:652
    const parts = dataString.split(',');
    
    const pH = parseFloat(parts[0].split(':')[1]);
    const temp = parseFloat(parts[1].split(':')[1]);
    const water = parts[2].split(':')[1];
    const tds = parseInt(parts[3].split(':')[1]);
    
    return { 
      pH, 
      temp, 
      water, 
      tds,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Error parsing Arduino data:', error);
    return null;
  }
};

// POST - Add new sensor reading
export const addSensorReading = async (dataString: string): Promise<SensorData | null> => {
  const parsedData = parseArduinoData(dataString);
  
  if (parsedData) {
    try {
      // Use the database service to save the reading
      await saveSensorReading(parsedData);
      console.log('Added new sensor reading:', parsedData);
      return parsedData;
    } catch (error) {
      console.error('Failed to save sensor reading:', error);
      return null;
    }
  }
  
  return null;
};

// GET - Retrieve the latest reading
export const getLatestReading = async (): Promise<SensorData | null> => {
  // Use the database service to get the latest reading
  return await getLatestSensorReading();
};

// GET - Retrieve all readings
export const getAllReadings = async (): Promise<SensorData[]> => {
  // Use the database service to get all readings
  return await getAllSensorReadings();
};
