
# Arduino Serial Reader Service

This is a standalone service that reads data from an Arduino via USB and sends it to the API service.

## Features

- Automatic Arduino port detection
- Robust error handling and reconnection logic
- Local caching of readings when API is unavailable
- Detailed logging for troubleshooting

## Usage

### Running Directly

1. Make sure you have Python 3 and pip installed
2. Run the service directly:

```bash
# Make the script executable
chmod +x run.sh

# Run the service
./run.sh
```

### Running with Docker

The service is included in the main docker-compose.yml and will start automatically with:

```bash
docker-compose up -d
```

To run just the Arduino reader service:

```bash
docker-compose up -d arduino-reader
```

### Environment Variables

You can customize the service behavior with these environment variables:

- `ARDUINO_SERIAL_PORT`: Serial port to use (e.g., `/dev/ttyUSB0`)
- `ARDUINO_BAUD_RATE`: Baud rate for serial communication (default: 9600)
- `API_URL`: URL of the API endpoint (default: http://api:3001/api/readings)
- `READ_INTERVAL`: Seconds between readings (default: 5)

## Troubleshooting

If the service can't find your Arduino:

1. List available serial ports: `ls /dev/tty*`
2. Check the logs: `docker-compose logs arduino-reader`
3. Try connecting manually: `cat /dev/ttyUSB0` (replace with your port)
4. Make sure your Arduino is sending data in the expected format: `pH:X.XX,temp:X.XX,water:XXX,tds:XXX`
