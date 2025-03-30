
import { useState, useEffect } from 'react';
import axios from 'axios';

// API base URL - change this to match your setup
const API_URL = 'http://localhost:3001/api';

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
  const [isLoading, setIsLoading] = useState(false);

  // Function to fetch all readings
  const fetchAllReadings = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/readings`);
      setAllReadings(response.data);
      
      if (response.data.length > 0) {
        setLatestReading(response.data[response.data.length - 1]);
      }
      
      setError(null);
    } catch (err) {
      console.error('Error fetching readings:', err);
      setError('Failed to fetch readings');
    } finally {
      setIsLoading(false);
    }
  };

  // Function to fetch latest reading
  const fetchLatestReading = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/readings/latest`);
      setLatestReading(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching latest reading:', err);
      // Don't set error if 404 (no readings yet)
      if (axios.isAxiosError(err) && err.response?.status !== 404) {
        setError('Failed to fetch latest reading');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Function to manually add a reading (for testing without Arduino)
  const addReading = async (dataString?: string) => {
    if (!dataString) {
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await axios.post(`${API_URL}/readings`, { data: dataString });
      
      if (response.status === 201) {
        setLatestReading(response.data);
        fetchAllReadings(); // Refresh the list after adding
      }
      
      setError(null);
    } catch (err) {
      console.error('Error adding reading:', err);
      setError('Failed to add reading');
    } finally {
      setIsLoading(false);
    }
  };

  // Initial data load
  useEffect(() => {
    fetchAllReadings();
    
    // Set up interval for periodic updates
    const intervalId = setInterval(() => {
      fetchLatestReading();
    }, 5000); // Check for new data every 5 seconds
    
    return () => clearInterval(intervalId);
  }, []);

  return {
    latestReading,
    allReadings,
    addReading,
    error,
    isLoading,
    refreshData: fetchAllReadings
  };
}
