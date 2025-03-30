// This file simulates a RESTful API service that would interact with Arduino data

interface SensorData {
  pH: number;
  temp: number;
  water: string;
  tds: number;
  timestamp: number;
}

// In-memory storage of sensor readings (in a real app, this would use a database)
let sensorReadings: SensorData[] = [];

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
export const addSensorReading = (dataString: string): SensorData | null => {
  const parsedData = parseArduinoData(dataString);
  
  if (parsedData) {
    sensorReadings.push(parsedData);
    console.log('Added new sensor reading:', parsedData);
    
    // Keep only the most recent 100 readings
    if (sensorReadings.length > 100) {
      sensorReadings = sensorReadings.slice(-100);
    }
  }
  
  return parsedData;
};

// GET - Retrieve the latest reading
export const getLatestReading = (): SensorData | null => {
  if (sensorReadings.length === 0) return null;
  return sensorReadings[sensorReadings.length - 1];
};

// GET - Retrieve all readings
export const getAllReadings = (): SensorData[] => {
  return [...sensorReadings];
};
