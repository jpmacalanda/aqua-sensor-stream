
import { useState, useEffect } from "react";
import { useSensorData } from "@/hooks/useSensorData";
import SensorDisplay from "@/components/SensorDisplay";
import DataRefreshControl from "@/components/DataRefreshControl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

const Index = () => {
  const { latestReading, addReading } = useSensorData();
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [manualInput, setManualInput] = useState("");
  const { toast } = useToast();

  // Handle manual refresh
  const handleRefresh = () => {
    addReading();
    toast({
      title: "Data Refreshed",
      description: "Latest sensor data has been fetched",
    });
  };

  // Handle manual data submission (useful for testing or when Arduino is not connected)
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      addReading(manualInput);
      toast({
        title: "Data Added",
        description: "Sensor data has been manually added",
      });
      setManualInput("");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add manual data. Check format.",
        variant: "destructive"
      });
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

      {/* Manual Data Input (for testing without actual Arduino) */}
      <div className="mt-8">
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
  );
};

export default Index;
