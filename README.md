
# Water Quality Monitoring System

A real-time water quality monitoring system that receives sensor data from an Arduino connected to a Raspberry Pi.

## Project info

**URL**: https://lovable.dev/projects/b50ff209-b4ca-48d2-9dd5-77fbf6808bde

## Features

- RESTful API service to receive and store sensor data from Arduino
- Real-time web dashboard displaying water quality parameters
- Visualization of pH, temperature, water level, and TDS readings
- Manual data entry for testing without hardware
- Auto-refresh functionality to display the most recent readings

## Data Format

The system expects data from the Arduino in the following format:
```
pH:6.20,temp:23.20,water:medium,tds:652
```

Where:
- `pH`: The pH level of the water
- `temp`: Temperature in Celsius
- `water`: Water level (low, medium, high)
- `tds`: Total Dissolved Solids in parts per million (ppm)

## Hardware Setup (not included in this repo)

For a complete system, you would need:
1. Arduino with pH, temperature, water level, and TDS sensors
2. Raspberry Pi connected to Arduino via USB
3. Script on Raspberry Pi to read serial data from Arduino and send to this API

## Deployment

### For the Web App
Follow the standard Lovable deployment process:
```sh
# Install dependencies
npm i

# Start the development server
npm run dev
```

### For the Raspberry Pi (conceptual)
On your Raspberry Pi, you would need a simple script to:
1. Read data from Arduino's serial port
2. Send this data to the API endpoint

Example Python script (not included):
```python
import serial
import requests
import time

# Connect to Arduino's serial port
ser = serial.Serial('/dev/ttyUSB0', 9600)

# API endpoint (replace with your deployed URL)
api_url = "https://your-deployed-app.com/api/readings"

while True:
    # Read data from Arduino
    data = ser.readline().decode('utf-8').strip()
    
    # Send to API
    response = requests.post(api_url, json={"data": data})
    
    # Wait before next reading
    time.sleep(5)
```

## Technologies Used

- React with TypeScript
- Tailwind CSS for styling
- shadcn/ui for UI components

