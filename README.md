
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

## Hardware Setup

1. Connect your Arduino with pH, temperature, water level, and TDS sensors
2. Connect the Arduino to your Raspberry Pi via USB
3. Make sure your Arduino code sends data in the expected format

## Deployment

### Standard Deployment
Follow the standard Lovable deployment process:
```sh
# Install dependencies
npm i

# Start the development server
npm run dev
```

### Docker Deployment
The project is fully dockerized for easy deployment:

```sh
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the services
docker-compose down
```

### Raspberry Pi Setup

On your Raspberry Pi:

1. Install required Python packages:
```bash
pip install pyserial requests
```

2. Copy the `api/rpi_client.py` script to your Raspberry Pi
3. Edit the script to set the correct serial port and API URL
4. Run the script:
```bash
python rpi_client.py
```

The script will:
1. Read data from Arduino's serial port
2. Send this data to the API endpoint
3. Wait 5 seconds before the next reading

## API Endpoints

- `GET /api/readings` - Get all sensor readings
- `GET /api/readings/latest` - Get the most recent reading
- `POST /api/readings` - Add a new reading (send JSON with `data` field)

## Technologies Used

- React with TypeScript
- Tailwind CSS for styling
- shadcn/ui for UI components
- Node.js/Express for the API
- LowDB for simple data storage
- Docker for containerization
