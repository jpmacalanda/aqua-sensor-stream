
import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from "sonner";

// Dynamic API URL that adapts to environment and handles Docker networking
let API_BASE_URL = 'http://localhost:3001/api';  // Default for local development

// In browser environments, use window location to determine API URL
if (typeof window !== 'undefined') {
  // If the app is served from the same domain as the API
  const hostname = window.location.hostname;
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    // We're in production/deployed environment 
    // Use same hostname but with the API port
    API_BASE_URL = `http://${hostname}:3001/api`;
  }
}

console.log(`[${new Date().toISOString()}] Using API URL: ${API_BASE_URL}`);

// Alternative API URLs to try if the main one fails
const ALTERNATIVE_API_URLS = [
  'http://127.0.0.1:3001/api',
  'http://api:3001/api',
  // Current Docker service name with direct access
  window.location.protocol + '//' + window.location.host + '/api' // API served through reverse proxy
];

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
  const [apiUrl, setApiUrl] = useState(API_BASE_URL);
  const [lastCheckTime, setLastCheckTime] = useState<Date>(new Date());

  // Helper function to find working API URL
  const findWorkingApiUrl = async (): Promise<string | null> => {
    console.log(`[${new Date().toISOString()}] Searching for working API URL...`);
    setLastCheckTime(new Date());
    
    // First try the current API URL
    try {
      const response = await axios.get(`${apiUrl}`, { timeout: 2000 });
      if (response.status === 200) {
        console.log(`[${new Date().toISOString()}] Current API URL is working: ${apiUrl}`);
        return apiUrl;
      }
    } catch (err) {
      console.log(`[${new Date().toISOString()}] Current API URL failed: ${apiUrl}`);
    }
    
    // Try alternatives
    for (const altUrl of ALTERNATIVE_API_URLS) {
      try {
        console.log(`[${new Date().toISOString()}] Trying alternative API URL: ${altUrl}`);
        const response = await axios.get(`${altUrl}`, { timeout: 2000 });
        if (response.status === 200) {
          console.log(`[${new Date().toISOString()}] Found working API URL: ${altUrl}`);
          return altUrl;
        }
      } catch (err) {
        console.log(`[${new Date().toISOString()}] Alternative API URL failed: ${altUrl}`);
      }
    }
    
    return null;
  };

  // Function to fetch all readings
  const fetchAllReadings = async () => {
    setIsLoading(true);
    try {
      // Try to find working API URL if we're disconnected
      if (connectionStatus === 'disconnected') {
        const workingUrl = await findWorkingApiUrl();
        if (workingUrl && workingUrl !== apiUrl) {
          setApiUrl(workingUrl);
          console.log(`[${new Date().toISOString()}] Switching to new API URL: ${workingUrl}`);
        }
      }
      
      console.log(`[${new Date().toISOString()}] Fetching all sensor readings from ${apiUrl}/readings`);
      const response = await axios.get(`${apiUrl}/readings`, { timeout: 5000 });
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
          
          // Try to find a working API URL
          const workingUrl = await findWorkingApiUrl();
          if (workingUrl) {
            setApiUrl(workingUrl);
            console.log(`[${new Date().toISOString()}] Found new working API URL: ${workingUrl}`);
            // Try again with the new URL
            try {
              const response = await axios.get(`${workingUrl}/readings`, { timeout: 5000 });
              setAllReadings(response.data);
              if (response.data.length > 0) {
                setLatestReading(response.data[response.data.length - 1]);
              }
              setConnectionStatus('connected');
              setError(null);
              return;
            } catch (retryErr) {
              console.error(`[${new Date().toISOString()}] Retry with new URL failed:`, retryErr);
            }
          }
          
          setError(`Cannot connect to API server. Tried multiple URLs including ${apiUrl}.`);
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
      console.log(`[${new Date().toISOString()}] Fetching latest sensor reading from ${apiUrl}/readings/latest`);
      const response = await axios.get(`${apiUrl}/readings/latest`, { timeout: 5000 });
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
          
          // Only set disconnected status if we weren't already disconnected
          if (connectionStatus !== 'disconnected') {
            setConnectionStatus('disconnected');
            
            // Try to find a working API URL
            const workingUrl = await findWorkingApiUrl();
            if (workingUrl && workingUrl !== apiUrl) {
              setApiUrl(workingUrl);
              console.log(`[${new Date().toISOString()}] Found new working API URL: ${workingUrl}`);
              // Don't automatically retry here to avoid potential loops
              return;
            }
            
            setError(`Cannot connect to API server at ${apiUrl}. Is it running?`);
            toast.error("Cannot connect to API server. Check console for details.");
          }
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
      const response = await axios.post(`${apiUrl}/readings`, { data: dataString }, { timeout: 5000 });
      
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
          
          // Try to find a working API URL
          const workingUrl = await findWorkingApiUrl();
          if (workingUrl && workingUrl !== apiUrl) {
            setApiUrl(workingUrl);
            console.log(`[${new Date().toISOString()}] Found new working API URL: ${workingUrl}`);
            toast.info(`Switched to new API URL: ${workingUrl}`);
            return;
          }
          
          setError(`Cannot connect to API server at ${apiUrl}. Is it running?`);
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

  // Initial data load and connection check
  useEffect(() => {
    console.log(`[${new Date().toISOString()}] Initial connection check`);
    // Try to find working API URL first
    findWorkingApiUrl().then(workingUrl => {
      if (workingUrl) {
        setApiUrl(workingUrl);
        console.log(`[${new Date().toISOString()}] Using API URL: ${workingUrl}`);
        fetchAllReadings();
      } else {
        console.error(`[${new Date().toISOString()}] Could not find working API URL`);
        setConnectionStatus('disconnected');
        setError("Could not connect to API server. Please check if it's running.");
        toast.error("Cannot connect to API server");
      }
    });
    
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
    refreshData: fetchAllReadings,
    apiUrl,
    lastCheckTime
  };
}
