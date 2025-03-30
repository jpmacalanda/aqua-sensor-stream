
import { useState, useEffect } from 'react';
import { getAllReadings, getLatestReading, addSensorReading } from '../services/apiService';

// This is a custom hook that will handle:
// 1. Getting sensor data
// 2. Updating sensor data (would connect to Arduino in real app)
// 3. Providing real-time updates

interface SensorData {
  pH: number;
  temp: number;
  water: string;
  tds: number;
  timestamp: number;
}

export function useSensorData() {
  const [latestReading, setLatestReading] = useState<SensorData | null>(null);
  const [allReadings, setAllReadings] = useState<SensorData[]>([]);
  const [error, setError] = useState<string | null>(null);

  // For simulation purposes - this would be real Arduino data in production
  const simulateArduinoData = () => {
    // Generate random values within realistic ranges
    const ph = (6 + Math.random()).toFixed(2);
    const temp = (20 + Math.random() * 5).toFixed(2);
    const waterLevels = ['low', 'medium', 'high'];
    const water = waterLevels[Math.floor(Math.random() * waterLevels.length)];
    const tds = Math.floor(600 + Math.random() * 100);
    
    return `pH:${ph},temp:${temp},water:${water},tds:${tds}`;
  };

  // Function to add a new reading (would receive real data from Arduino/Raspberry Pi)
  const addReading = (dataString?: string) => {
    try {
      // If no data string is provided, generate simulated data
      const data = dataString || simulateArduinoData();
      const newReading = addSensorReading(data);
      
      if (newReading) {
        setLatestReading(newReading);
        setAllReadings(getAllReadings());
      }
    } catch (err) {
      setError('Failed to add sensor reading');
      console.error(err);
    }
  };

  // Simulate real-time data updates
  useEffect(() => {
    // Initial data load
    const readings = getAllReadings();
    if (readings.length > 0) {
      setAllReadings(readings);
      setLatestReading(getLatestReading());
    } else {
      // If no data exists, add simulated data
      addReading();
    }

    // Set up periodic data updates to simulate Arduino sending data
    const intervalId = setInterval(() => {
      addReading();
    }, 3000); // Simulate data coming in every 3 seconds

    return () => clearInterval(intervalId);
  }, []);

  return {
    latestReading,
    allReadings,
    addReading,
    error
  };
}
