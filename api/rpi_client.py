
import serial
import requests
import time
import json
import logging
import os
import sys
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('arduino_readings.log')
    ]
)

# Configure these settings
SERIAL_PORT = '/dev/ttyUSB0'  # Change this to match your Arduino's serial port
BAUD_RATE = 9600
API_URL = 'http://localhost:3001/api/readings'  # Change this to your API's address
READ_INTERVAL = 5  # Seconds between readings

def main():
    logging.info(f"Starting Arduino sensor reader script")
    logging.info(f"Serial port: {SERIAL_PORT}")
    logging.info(f"Baud rate: {BAUD_RATE}")
    logging.info(f"API URL: {API_URL}")
    
    # Check if serial port exists
    if not os.path.exists(SERIAL_PORT):
        logging.error(f"Serial port {SERIAL_PORT} does not exist!")
        logging.info(f"Available devices in /dev:")
        for device in os.listdir('/dev'):
            if 'tty' in device:
                logging.info(f"  - /dev/{device}")
        return
    
    try:
        # Connect to Arduino's serial port
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=5)
        logging.info(f"Connected to Arduino on {SERIAL_PORT}")
        
        # Flush initial data
        logging.info("Flushing initial data from serial buffer")
        ser.flushInput()
        time.sleep(2)
        
        while True:
            try:
                # Read data from Arduino
                serial_line = ser.readline()
                if not serial_line:
                    logging.warning("No data received from Arduino (timeout)")
                    time.sleep(1)
                    continue
                
                data = serial_line.decode('utf-8').strip()
                if not data:
                    logging.warning("Received empty data from Arduino")
                    time.sleep(1)
                    continue
                
                logging.info(f"Received data: {data}")
                
                # Validate data format (simple check)
                if "pH:" not in data or "temp:" not in data:
                    logging.warning(f"Data doesn't match expected format: {data}")
                    time.sleep(1)
                    continue
                
                # Send to API
                try:
                    logging.info(f"Sending data to API: {data}")
                    response = requests.post(API_URL, json={"data": data}, timeout=10)
                    
                    if response.status_code == 201:
                        logging.info("Data successfully sent to API")
                        logging.info(json.dumps(response.json(), indent=2))
                    else:
                        logging.error(f"API error: {response.status_code}")
                        logging.error(response.text)
                except requests.exceptions.ConnectionError as e:
                    logging.error(f"Connection error: {e}")
                    logging.info("Is the API server running? Check the URL and connectivity")
                except Exception as e:
                    logging.error(f"Error sending data to API: {e}")
                
                # Wait before next reading
                logging.info(f"Waiting {READ_INTERVAL} seconds before next reading")
                time.sleep(READ_INTERVAL)
                
            except serial.SerialException as e:
                logging.error(f"Serial error during read: {e}")
                time.sleep(5)  # Wait before trying again
                
            except UnicodeDecodeError as e:
                logging.error(f"Decode error: {e}")
                logging.error(f"Raw data: {serial_line}")
                time.sleep(1)
    
    except KeyboardInterrupt:
        logging.info("Script terminated by user")
    except serial.SerialException as e:
        logging.error(f"Serial connection error: {e}")
        logging.error(f"Make sure Arduino is connected to {SERIAL_PORT}")
    finally:
        logging.info("Shutting down")
        try:
            ser.close()
            logging.info("Serial port closed")
        except:
            pass

if __name__ == "__main__":
    main()
