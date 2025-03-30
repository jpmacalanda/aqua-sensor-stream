
import { useState, useEffect } from "react";
import { useSensorData } from "@/hooks/useSensorData";
import SensorDisplay from "@/components/SensorDisplay";
import DataRefreshControl from "@/components/DataRefreshControl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const Index = () => {
  const { latestReading, addReading, generateTestData, connectionStatus, apiUrl } = useSensorData();
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [manualInput, setManualInput] = useState("");

  // Handle manual refresh
  const handleRefresh = () => {
    addReading();
    toast.info("Data refresh requested");
  };

  // Handle test data generation
  const handleGenerateTestData = async () => {
    try {
      await generateTestData();
      toast.success("Test data generated successfully");
    } catch (error) {
      toast.error("Failed to generate test data");
    }
  };

  // Handle manual data submission (useful for testing or when Arduino is not connected)
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (!manualInput) {
        toast.error("Please enter sensor data");
        return;
      }
      
      addReading(manualInput);
      toast.success("Manual data submitted");
      setManualInput("");
    } catch (error) {
      toast.error("Failed to add manual data. Check format.");
    }
  };

  // Set up auto-refresh
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (isAutoRefresh) {
      intervalId = setInterval(() => {
        addReading();
      }, 5000); // Refresh every 5 seconds
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isAutoRefresh, addReading]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Water Quality Monitoring</h1>
        <p className="text-gray-600">Real-time sensor data from Arduino via Raspberry Pi</p>
        
        {/* API Connection Status */}
        <div className="mt-2">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            connectionStatus === 'connected' ? 'bg-green-100 text-green-800' : 
            connectionStatus === 'disconnected' ? 'bg-red-100 text-red-800' : 
            'bg-gray-100 text-gray-800'
          }`}>
            {connectionStatus === 'connected' ? 'Connected to API' : 
             connectionStatus === 'disconnected' ? 'Disconnected from API' : 
             'API Connection Unknown'}
          </span>
          {apiUrl && <p className="text-xs text-gray-500 mt-1">API: {apiUrl}</p>}
        </div>
      </div>

      <DataRefreshControl
        onRefresh={handleRefresh}
        isAutoRefresh={isAutoRefresh}
        setAutoRefresh={setIsAutoRefresh}
        lastUpdateTime={latestReading?.timestamp}
      />

      <SensorDisplay 
        data={latestReading} 
        isLoading={!latestReading}
      />

      {/* Manual Data Input and Test Data Generation */}
      <div className="mt-8 space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">Test Data</h2>
          <Button 
            onClick={handleGenerateTestData} 
            className="bg-blue-500 hover:bg-blue-600"
          >
            Generate Test Data
          </Button>
          <p className="text-sm text-gray-500 mt-2">
            This will create sample sensor data for testing without requiring an Arduino connection.
          </p>
        </div>
        
        <div>
          <h2 className="text-xl font-semibold mb-4">Manual Data Input</h2>
          <p className="text-sm text-gray-500 mb-4">
            For testing or when Arduino is not connected. Enter data in format: pH:6.20,temp:23.20,water:medium,tds:652
          </p>
          
          <form onSubmit={handleManualSubmit} className="flex flex-col sm:flex-row gap-2">
            <Input
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="pH:6.20,temp:23.20,water:medium,tds:652"
              className="flex-1"
            />
            <Button type="submit">Submit</Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Index;
