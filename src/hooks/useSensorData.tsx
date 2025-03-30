import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from "sonner";

// API base URL - change this to match your setup
// Use the API service name in production (Docker), fallback to localhost for development
const API_URL = import.meta.env.PROD 
  ? 'http://api:3001/api'  // Docker service name
  : 'http://localhost:3001/api';  // Local development

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
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'unknown'>('unknown');

  // Function to fetch all readings
  const fetchAllReadings = async () => {
    setIsLoading(true);
    try {
      console.log(`[${new Date().toISOString()}] Fetching all sensor readings from ${API_URL}/readings`);
      const response = await axios.get(`${API_URL}/readings`);
      console.log(`[${new Date().toISOString()}] Received ${response.data.length} readings`);
      
      setAllReadings(response.data);
      
      if (response.data.length > 0) {
        setLatestReading(response.data[response.data.length - 1]);
        console.log(`[${new Date().toISOString()}] Latest reading:`, response.data[response.data.length - 1]);
      } else {
        console.log(`[${new Date().toISOString()}] No readings found in database`);
      }
      
      setConnectionStatus('connected');
      setError(null);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Error fetching readings:`, err);
      
      if (axios.isAxiosError(err)) {
        if (err.code === 'ERR_NETWORK') {
          console.error(`[${new Date().toISOString()}] Network error - API server might be down`);
          setConnectionStatus('disconnected');
          setError(`Cannot connect to API server at ${API_URL}. Is it running?`);
          toast.error("Cannot connect to API server. Check console for details.");
        } else {
          setError(`Failed to fetch readings: ${err.message}`);
        }
      } else {
        setError('Failed to fetch readings');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Function to fetch latest reading
  const fetchLatestReading = async () => {
    setIsLoading(true);
    try {
      console.log(`[${new Date().toISOString()}] Fetching latest sensor reading from ${API_URL}/readings/latest`);
      const response = await axios.get(`${API_URL}/readings/latest`);
      console.log(`[${new Date().toISOString()}] Received latest reading:`, response.data);
      
      setLatestReading(response.data);
      setConnectionStatus('connected');
      setError(null);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Error fetching latest reading:`, err);
      
      // Don't set error if 404 (no readings yet)
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 404) {
          console.log(`[${new Date().toISOString()}] No readings available yet`);
        } else if (err.code === 'ERR_NETWORK') {
          console.error(`[${new Date().toISOString()}] Network error - API server might be down`);
          setConnectionStatus('disconnected');
          setError(`Cannot connect to API server at ${API_URL}. Is it running?`);
          toast.error("Cannot connect to API server. Check console for details.");
        } else {
          setError(`Failed to fetch latest reading: ${err.message}`);
        }
      } else {
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
      console.log(`[${new Date().toISOString()}] Manually adding reading: ${dataString}`);
      const response = await axios.post(`${API_URL}/readings`, { data: dataString });
      
      if (response.status === 201) {
        console.log(`[${new Date().toISOString()}] Reading added successfully:`, response.data);
        setLatestReading(response.data);
        fetchAllReadings(); // Refresh the list after adding
        toast.success("Sensor reading added successfully");
      }
      
      setConnectionStatus('connected');
      setError(null);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Error adding reading:`, err);
      
      if (axios.isAxiosError(err)) {
        if (err.code === 'ERR_NETWORK') {
          console.error(`[${new Date().toISOString()}] Network error - API server might be down`);
          setConnectionStatus('disconnected');
          setError(`Cannot connect to API server at ${API_URL}. Is it running?`);
          toast.error("Cannot connect to API server. Check console for details.");
        } else {
          setError(`Failed to add reading: ${err.message}`);
          toast.error(`Failed to add reading: ${err.message}`);
        }
      } else {
        setError('Failed to add reading');
        toast.error("Failed to add reading");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Initial data load
  useEffect(() => {
    console.log(`[${new Date().toISOString()}] Initial data load`);
    fetchAllReadings();
    
    // Set up interval for periodic updates
    console.log(`[${new Date().toISOString()}] Setting up 5-second interval for data updates`);
    const intervalId = setInterval(() => {
      console.log(`[${new Date().toISOString()}] Interval triggered - fetching latest reading`);
      fetchLatestReading();
    }, 5000); // Check for new data every 5 seconds
    
    return () => {
      console.log(`[${new Date().toISOString()}] Clearing update interval`);
      clearInterval(intervalId);
    };
  }, []);

  return {
    latestReading,
    allReadings,
    addReading,
    error,
    isLoading,
    connectionStatus,
    refreshData: fetchAllReadings
  };
}
