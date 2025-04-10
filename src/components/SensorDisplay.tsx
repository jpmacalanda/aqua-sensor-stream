
import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SensorData {
  pH: number;
  temp: number;
  water: string;
  tds: number;
  timestamp: number;
}

interface SensorDisplayProps {
  data: SensorData | null;
  isLoading?: boolean;
}

const SensorDisplay: React.FC<SensorDisplayProps> = ({ data, isLoading = false }) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-pulse text-lg">Loading sensor data...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="text-lg text-gray-500">No sensor data available</div>
      </div>
    );
  }

  // Get water level color
  const getWaterLevelColor = (level: string | undefined) => {
    if (!level) return 'bg-gray-500';
    
    switch (level.toLowerCase()) {
      case 'low':
        return 'bg-red-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'high':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Get pH color
  const getPHColor = (ph: number | undefined) => {
    if (ph === undefined) return 'text-gray-500';
    if (ph < 6.5) return 'text-red-500';
    if (ph > 7.5) return 'text-blue-500';
    return 'text-green-500';
  };

  const formatTime = (timestamp: number | undefined) => {
    return timestamp ? new Date(timestamp).toLocaleTimeString() : 'Unknown';
  };

  // Add a safe formatter to handle potential undefined values
  const safeFormat = (value: number | undefined, digits: number = 2) => {
    return value !== undefined ? value.toFixed(digits) : 'N/A';
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* pH Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">pH Level</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getPHColor(data.pH)}`}>
              {safeFormat(data.pH)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Last updated at {formatTime(data.timestamp)}
            </p>
          </CardContent>
        </Card>

        {/* Temperature Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Temperature</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {safeFormat(data.temp, 1)} °C
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Last updated at {formatTime(data.timestamp)}
            </p>
          </CardContent>
        </Card>

        {/* Water Level Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Water Level</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Badge className={`${getWaterLevelColor(data.water)} capitalize`}>
                {data.water || 'Unknown'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Last updated at {formatTime(data.timestamp)}
            </p>
          </CardContent>
        </Card>

        {/* TDS Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">TDS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.tds !== undefined ? `${data.tds} ppm` : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Last updated at {formatTime(data.timestamp)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Raw Data Display */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Raw Sensor Data</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-x-auto">
            {`pH:${safeFormat(data.pH)},temp:${safeFormat(data.temp, 2)},water:${data.water || 'unknown'},tds:${data.tds !== undefined ? data.tds : 'N/A'}`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
};

export default SensorDisplay;
