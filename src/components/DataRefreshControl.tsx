
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { RefreshCw } from "lucide-react";

interface DataRefreshControlProps {
  onRefresh: () => void;
  isAutoRefresh: boolean;
  setAutoRefresh: (value: boolean) => void;
  lastUpdateTime?: number;
}

const DataRefreshControl: React.FC<DataRefreshControlProps> = ({
  onRefresh,
  isAutoRefresh,
  setAutoRefresh,
  lastUpdateTime
}) => {
  const formatTime = (timestamp?: number) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleTimeString();
  };
  
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 p-4 bg-slate-50 rounded-lg">
      <div className="flex items-center gap-2">
        <Button 
          onClick={onRefresh} 
          variant="outline" 
          size="sm"
          className="flex items-center gap-1"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh Now
        </Button>
        
        <div className="text-sm text-muted-foreground">
          Last updated: {formatTime(lastUpdateTime)}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Auto refresh:</span>
        <Switch 
          checked={isAutoRefresh} 
          onCheckedChange={setAutoRefresh} 
        />
      </div>
    </div>
  );
};

export default DataRefreshControl;
