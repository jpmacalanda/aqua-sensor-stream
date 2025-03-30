
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
API_URL = 'http://api:3001/api/readings'  # Use service name in docker-compose
READ_INTERVAL = 5  # Seconds between readings

# Alternative API URLs to try if the main one fails
ALTERNATIVE_API_URLS = [
    'http://localhost:3001/api/readings',
    'http://127.0.0.1:3001/api/readings'
]

def check_api_connection():
    """Test connectivity to API server and determine best URL"""
    all_urls = [API_URL] + ALTERNATIVE_API_URLS
    
    for url in all_urls:
        try:
            base_url = url.rsplit('/', 1)[0]  # Remove 'readings' from the end
            test_url = f"{base_url}"
            logging.info(f"Testing API connection to: {test_url}")
            response = requests.get(test_url, timeout=5)
            if response.status_code == 200:
                logging.info(f"Successfully connected to API at: {test_url}")
                return url
        except requests.exceptions.RequestException as e:
            logging.warning(f"Failed to connect to {test_url}: {str(e)}")
    
    logging.error("Failed to connect to API server on all URLs")
    return None

def list_serial_ports():
    """List all available serial ports"""
    import glob
    
    if sys.platform.startswith('win'):
        ports = ['COM%s' % (i + 1) for i in range(256)]
    elif sys.platform.startswith('linux') or sys.platform.startswith('cygwin'):
        # This excludes your current terminal "/dev/tty"
        ports = glob.glob('/dev/tty[A-Za-z]*')
    elif sys.platform.startswith('darwin'):
        ports = glob.glob('/dev/tty.*')
    else:
        raise EnvironmentError('Unsupported platform')
    
    result = []
    for port in ports:
        try:
            s = serial.Serial(port)
            s.close()
            result.append(port)
        except (OSError, serial.SerialException):
            pass
    
    return result

def main():
    logging.info("=" * 50)
    logging.info(f"Starting Arduino sensor reader script")
    logging.info(f"Serial port: {SERIAL_PORT}")
    logging.info(f"Baud rate: {BAUD_RATE}")
    logging.info(f"Read interval: {READ_INTERVAL} seconds")
    
    # Check for API connectivity and get best URL
    working_api_url = check_api_connection()
    if working_api_url:
        logging.info(f"Using API URL: {working_api_url}")
    else:
        logging.error("Could not connect to API. Will store readings locally until connection is restored.")
    
    # List available serial ports
    logging.info("Available serial ports:")
    available_ports = list_serial_ports()
    if not available_ports:
        logging.error("No serial ports found!")
    else:
        for port in available_ports:
            logging.info(f"  - {port}")
    
    # Check if specified serial port exists
    if not os.path.exists(SERIAL_PORT):
        logging.error(f"Specified serial port {SERIAL_PORT} does not exist!")
        logging.info(f"Available devices in /dev:")
        for device in os.listdir('/dev'):
            if 'tty' in device:
                logging.info(f"  - /dev/{device}")
        
        # Try to find a USB device automatically
        usb_devices = [device for device in available_ports if 'USB' in device or 'ACM' in device]
        if usb_devices:
            logging.info(f"Found USB devices: {usb_devices}")
            logging.info(f"Trying to use {usb_devices[0]} instead")
            serial_port = usb_devices[0]
        else:
            logging.error("No USB devices found. Please check Arduino connection.")
            return
    else:
        serial_port = SERIAL_PORT
    
    # Local storage for readings if API is unreachable
    local_readings = []
    
    try:
        # Connect to Arduino's serial port
        ser = serial.Serial(serial_port, BAUD_RATE, timeout=5)
        logging.info(f"Connected to Arduino on {serial_port}")
        
        # Flush initial data
        logging.info("Flushing initial data from serial buffer")
        ser.flushInput()
        time.sleep(2)
        
        connection_failures = 0
        while True:
            try:
                # Read data from Arduino
                logging.info("Waiting for data from Arduino...")
                serial_line = ser.readline()
                if not serial_line:
                    logging.warning("No data received from Arduino (timeout)")
                    time.sleep(1)
                    continue
                
                try:
                    data = serial_line.decode('utf-8').strip()
                except UnicodeDecodeError:
                    logging.error(f"Failed to decode data: {serial_line!r}")
                    time.sleep(1)
                    continue
                
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
                if working_api_url:
                    try:
                        logging.info(f"Sending data to API: {data}")
                        headers = {'Content-Type': 'application/json'}
                        response = requests.post(
                            working_api_url, 
                            json={"data": data}, 
                            headers=headers,
                            timeout=10
                        )
                        
                        logging.info(f"API response status: {response.status_code}")
                        logging.info(f"API response body: {response.text}")
                        
                        if response.status_code == 201:
                            logging.info("Data successfully sent to API")
                            connection_failures = 0
                            
                            # Send any cached readings
                            if local_readings:
                                logging.info(f"Sending {len(local_readings)} cached readings")
                                for cached_data in local_readings:
                                    try:
                                        cached_response = requests.post(
                                            working_api_url, 
                                            json={"data": cached_data},
                                            headers=headers,
                                            timeout=10
                                        )
                                        logging.info(f"Cached data sent, status: {cached_response.status_code}")
                                    except Exception as e:
                                        logging.error(f"Failed to send cached data: {str(e)}")
                                        break
                                local_readings = []
                        else:
                            logging.error(f"API error: {response.status_code}")
                            logging.error(response.text)
                            connection_failures += 1
                    except requests.exceptions.RequestException as e:
                        logging.error(f"Connection error: {str(e)}")
                        logging.info("Storing reading locally")
                        local_readings.append(data)
                        connection_failures += 1
                        
                        # Check if we need to find a new API URL
                        if connection_failures > 5:
                            logging.warning("Multiple connection failures, checking for alternative API URL")
                            new_api_url = check_api_connection()
                            if new_api_url and new_api_url != working_api_url:
                                logging.info(f"Switching to new API URL: {new_api_url}")
                                working_api_url = new_api_url
                                connection_failures = 0
                else:
                    # Store locally
                    logging.info("API unavailable, storing reading locally")
                    local_readings.append(data)
                    
                    # Periodically check if API is back online
                    if len(local_readings) % 5 == 0:
                        logging.info("Checking if API is back online...")
                        working_api_url = check_api_connection()
                
                # Wait before next reading
                logging.info(f"Waiting {READ_INTERVAL} seconds before next reading")
                time.sleep(READ_INTERVAL)
                
            except serial.SerialException as e:
                logging.error(f"Serial error during read: {str(e)}")
                logging.info("Attempting to reconnect to serial port...")
                try:
                    ser.close()
                    time.sleep(2)
                    ser = serial.Serial(serial_port, BAUD_RATE, timeout=5)
                    ser.flushInput()
                    logging.info("Successfully reconnected to serial port")
                except Exception as reconnect_error:
                    logging.error(f"Failed to reconnect: {str(reconnect_error)}")
                    time.sleep(5)  # Wait before trying again
                
            except Exception as e:
                logging.error(f"Unexpected error: {str(e)}")
                time.sleep(5)
    
    except KeyboardInterrupt:
        logging.info("Script terminated by user")
    except serial.SerialException as e:
        logging.error(f"Serial connection error: {str(e)}")
        logging.error(f"Make sure Arduino is connected to {serial_port}")
    except Exception as e:
        logging.error(f"Unexpected error: {str(e)}")
    finally:
        logging.info("Shutting down")
        try:
            ser.close()
            logging.info("Serial port closed")
        except:
            pass
        
        # Save any unsent readings to file
        if local_readings:
            logging.info(f"Saving {len(local_readings)} unsent readings to file")
            with open('unsent_readings.json', 'w') as f:
                json.dump(local_readings, f)

if __name__ == "__main__":
    main()
