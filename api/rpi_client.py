
import serial
import requests
import time
import json

# Configure these settings
SERIAL_PORT = '/dev/ttyUSB0'  # Change this to match your Arduino's serial port
BAUD_RATE = 9600
API_URL = 'http://localhost:3001/api/readings'  # Change this to your API's address

def main():
    try:
        # Connect to Arduino's serial port
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE)
        print(f"Connected to Arduino on {SERIAL_PORT}")
        
        while True:
            # Read data from Arduino
            data = ser.readline().decode('utf-8').strip()
            print(f"Received data: {data}")
            
            # Send to API
            try:
                response = requests.post(API_URL, json={"data": data})
                
                if response.status_code == 201:
                    print("Data successfully sent to API")
                    print(json.dumps(response.json(), indent=2))
                else:
                    print(f"API error: {response.status_code}")
                    print(response.text)
            except Exception as e:
                print(f"Error sending data to API: {e}")
            
            # Wait before next reading
            time.sleep(5)
    
    except KeyboardInterrupt:
        print("Script terminated by user")
    except serial.SerialException as e:
        print(f"Serial connection error: {e}")
        print(f"Make sure Arduino is connected to {SERIAL_PORT}")

if __name__ == "__main__":
    main()
