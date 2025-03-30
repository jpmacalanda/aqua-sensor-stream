
#!/bin/bash

# Simple script to run the Arduino reader service directly

# Check if pyserial and requests are installed
if ! python3 -c "import serial, requests" 2>/dev/null; then
    echo "Installing required Python packages..."
    pip3 install pyserial requests
fi

# Run the service
echo "Starting Arduino reader service..."
python3 serial_reader.py
