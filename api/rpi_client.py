
import serial
import requests
import time
import json
import logging
import os
import sys
import glob
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

# List of possible USB ports to try for Arduino - put the most likely ones first
POSSIBLE_USB_PORTS = ['/dev/ttyUSB0', '/dev/ttyACM0', '/dev/ttyUSB1', '/dev/ttyUSB2', '/dev/ttyUSB3']
DEFAULT_SERIAL_PORT = '/dev/ttyUSB0'  # Default fallback
BAUD_RATE = 9600
API_URL = 'http://api:3001/api/readings'  # Use service name in docker-compose
READ_INTERVAL = 5  # Seconds between readings

# Alternative API URLs to try if the main one fails
ALTERNATIVE_API_URLS = [
    'http://localhost:3001/api/readings',
    'http://127.0.0.1:3001/api/readings'
]

def find_arduino_port():
    """Automatically find Arduino serial port"""
    logging.info("========== ARDUINO DETECTION START ==========")
    logging.info(f"Searching for Arduino on available serial ports...")
    
    # First check if the default port exists, as it's the most likely
    if os.path.exists(DEFAULT_SERIAL_PORT):
        logging.info(f"Default port {DEFAULT_SERIAL_PORT} exists, testing it first")
        try:
            s = serial.Serial(DEFAULT_SERIAL_PORT, BAUD_RATE, timeout=1)
            s.close()
            logging.info(f"✅ DEFAULT PORT {DEFAULT_SERIAL_PORT} IS WORKING!")
            logging.info(f"Testing if {DEFAULT_SERIAL_PORT} is actually sending sensor data...")
            if test_read_from_port(DEFAULT_SERIAL_PORT):
                logging.info(f"✅ CONFIRMED: Arduino sensor detected on {DEFAULT_SERIAL_PORT}")
                logging.info("========== ARDUINO DETECTION COMPLETE ==========")
                return DEFAULT_SERIAL_PORT
            else:
                logging.warning(f"⚠️ Port {DEFAULT_SERIAL_PORT} exists but doesn't appear to be sending valid sensor data")
        except (OSError, serial.SerialException) as e:
            logging.warning(f"⚠️ Default port {DEFAULT_SERIAL_PORT} exists but cannot be opened: {str(e)}")
    else:
        logging.warning(f"⚠️ Default port {DEFAULT_SERIAL_PORT} does not exist")
    
    # Common patterns for Arduino/CH341 devices
    if sys.platform.startswith('win'):
        ports = list(glob.glob('COM[0-9]*'))
        logging.info(f"Windows detected, checking COM ports: {', '.join(ports) if ports else 'None found'}")
    else:
        # Check for multiple USB ports (USB0-USB3)
        usb_ports = []
        for port in POSSIBLE_USB_PORTS:
            if os.path.exists(port):
                usb_ports.append(port)
                logging.info(f"Found USB port: {port}")
        
        # Also check for other common Arduino port types
        acm_ports = glob.glob('/dev/ttyACM*')
        if acm_ports:
            logging.info(f"Found ACM ports: {', '.join(acm_ports)}")
        
        ports = usb_ports + acm_ports
        if not ports:
            logging.error("❌ NO ARDUINO DETECTED: No USB serial ports found")
            logging.info("========== ARDUINO DETECTION FAILED ==========")
            return None
    
    # Try connecting to each port to find a working one
    for port in ports:
        try:
            logging.info(f"Testing port: {port}")
            s = serial.Serial(port, BAUD_RATE, timeout=1)
            s.close()
            logging.info(f"Port {port} can be opened, testing for sensor data...")
            
            if test_read_from_port(port):
                logging.info(f"✅ ARDUINO SENSOR DETECTED on {port}")
                logging.info("========== ARDUINO DETECTION COMPLETE ==========")
                return port
            else:
                logging.warning(f"⚠️ Port {port} is accessible but not sending valid sensor data")
        except (OSError, serial.SerialException) as e:
            logging.warning(f"⚠️ Port {port} unavailable: {str(e)}")
    
    logging.error("❌ NO ARDUINO SENSOR DETECTED: Checked all available ports but no valid sensor found")
    logging.info("========== ARDUINO DETECTION FAILED ==========")
    return None

def check_api_connection():
    """Check if the API is reachable and return working URL"""
    logging.info(f"Checking API connectivity...")
    
    # First try the primary API URL
    try:
        logging.info(f"Testing primary API URL: {API_URL}")
        response = requests.get(API_URL.replace('/readings', ''), timeout=2)
        if response.status_code == 200:
            logging.info(f"✅ Primary API URL is working: {API_URL}")
            return API_URL
    except requests.exceptions.RequestException as e:
        logging.warning(f"❌ Primary API URL failed: {str(e)}")
    
    # Try alternatives
    for alt_url in ALTERNATIVE_API_URLS:
        try:
            logging.info(f"Testing alternative API URL: {alt_url}")
            response = requests.get(alt_url.replace('/readings', ''), timeout=2)
            if response.status_code == 200:
                logging.info(f"✅ Alternative API URL is working: {alt_url}")
                return alt_url
        except requests.exceptions.RequestException as e:
            logging.warning(f"❌ Alternative API URL failed: {str(e)}")
    
    logging.error("❌ All API URLs failed. Cannot connect to API server.")
    return None
    
def list_serial_ports():
    """List all available serial ports"""
    ports = []
    
    if sys.platform.startswith('win'):
        # Windows
        for i in range(256):
            try:
                port = f'COM{i}'
                s = serial.Serial(port)
                s.close()
                ports.append(port)
                logging.info(f"Found port: {port}")
            except (OSError, serial.SerialException):
                pass
    else:
        # Linux/Mac
        for pattern in ['/dev/ttyS*', '/dev/ttyUSB*', '/dev/ttyACM*', '/dev/tty.*', '/dev/cu.*']:
            ports.extend(glob.glob(pattern))
        
        if ports:
            for port in ports:
                logging.info(f"Found port: {port}")
        else:
            logging.warning("No serial ports found")
    
    return ports

def test_read_from_port(port, attempts=3):
    """Test reading from a port to see if it returns valid sensor data"""
    logging.info(f"Testing for sensor data on {port} (will try {attempts} readings)")
    try:
        ser = serial.Serial(port, BAUD_RATE, timeout=3)
        ser.flushInput()
        
        for i in range(attempts):
            logging.info(f"Reading attempt {i+1} from {port}")
            try:
                serial_line = ser.readline()
                if serial_line:
                    try:
                        data = serial_line.decode('utf-8').strip()
                        logging.info(f"📊 Received raw data: {data}")
                        
                        # Check if it contains expected Arduino sensor format (pH, temp, etc.)
                        if "pH:" in data and "temp:" in data:
                            logging.info(f"✅ VALID SENSOR DATA detected on {port}: {data}")
                            ser.close()
                            return True
                        else:
                            logging.info(f"⚠️ Data doesn't match expected format (pH:x,temp:x): {data}")
                    except UnicodeDecodeError:
                        logging.info(f"⚠️ Received non-UTF8 data: {serial_line!r}")
                else:
                    logging.info(f"⚠️ No data received from {port} (timeout)")
            except Exception as e:
                logging.warning(f"⚠️ Error reading from port: {str(e)}")
            
            time.sleep(1)
        
        ser.close()
        logging.warning(f"❌ No valid sensor data detected on {port} after {attempts} attempts")
    except Exception as e:
        logging.warning(f"❌ Could not open {port} for testing: {str(e)}")
    
    return False

def main():
    logging.info("=" * 80)
    logging.info(f"🚀 STARTING ARDUINO SENSOR READER SCRIPT")
    logging.info(f"⚙️ Configuration:")
    logging.info(f"  - USB ports to check: {', '.join(POSSIBLE_USB_PORTS)}")
    logging.info(f"  - Default port: {DEFAULT_SERIAL_PORT}")
    logging.info(f"  - Baud rate: {BAUD_RATE}")
    logging.info(f"  - Read interval: {READ_INTERVAL} seconds")
    logging.info(f"  - API URL: {API_URL}")
    logging.info("=" * 80)
    
    # List all available serial ports first for diagnostic purposes
    logging.info("🔍 Available serial ports:")
    available_ports = list_serial_ports()
    if not available_ports:
        logging.error("❌ No serial ports found!")
    else:
        for port in available_ports:
            logging.info(f"  - {port}")
    
    # Auto-detect Arduino port
    serial_port = find_arduino_port()
    if not serial_port:
        logging.warning(f"⚠️ Could not auto-detect Arduino port. Will try default: {DEFAULT_SERIAL_PORT}")
        serial_port = DEFAULT_SERIAL_PORT
    
    # Test the port more thoroughly to make sure it's actually an Arduino sending sensor data
    logging.info(f"Using serial port: {serial_port}")
    
    # Check for API connectivity and get best URL
    working_api_url = check_api_connection()
    if working_api_url:
        logging.info(f"Using API URL: {working_api_url}")
    else:
        logging.error("Could not connect to API. Will store readings locally until connection is restored.")
    
    # Local storage for readings if API is unreachable
    local_readings = []
    
    try:
        # Connect to Arduino's serial port
        ser = None
        connection_attempts = 0
        max_connection_attempts = 10
        
        while True:
            try:
                if ser is None:
                    if connection_attempts >= max_connection_attempts:
                        logging.error(f"❌ Failed to connect to Arduino after {max_connection_attempts} attempts. Will retry from scratch.")
                        # Re-detect Arduino port
                        serial_port = find_arduino_port()
                        if not serial_port:
                            logging.error("❌ Still cannot find Arduino. Waiting 30 seconds before trying again...")
                            time.sleep(30)
                            connection_attempts = 0
                            continue
                    
                    logging.info(f"🔌 Attempting to connect to Arduino on {serial_port} (attempt {connection_attempts + 1})")
                    try:
                        ser = serial.Serial(serial_port, BAUD_RATE, timeout=5)
                        logging.info(f"✅ CONNECTED to Arduino on {serial_port}")
                        # Flush initial data
                        ser.flushInput()
                        time.sleep(2)
                        connection_attempts = 0  # Reset counter on successful connection
                    except Exception as e:
                        connection_attempts += 1
                        logging.error(f"❌ Failed to connect to {serial_port}: {str(e)}")
                        time.sleep(5)
                        continue
                
                # Read data from Arduino
                logging.info("📡 Waiting for data from Arduino...")
                serial_line = ser.readline()
                if not serial_line:
                    logging.warning("⚠️ No data received from Arduino (timeout)")
                    time.sleep(1)
                    continue
                
                try:
                    data = serial_line.decode('utf-8').strip()
                    logging.info(f"📊 Raw data received: {repr(data)}")
                except UnicodeDecodeError:
                    logging.error(f"❌ Failed to decode data: {serial_line!r}")
                    time.sleep(1)
                    continue
                
                if not data:
                    logging.warning("⚠️ Received empty data from Arduino")
                    time.sleep(1)
                    continue
                
                logging.info(f"📊 Processed data: {data}")
                
                # Validate data format (simple check)
                if "pH:" not in data or "temp:" not in data:
                    logging.warning(f"⚠️ Data doesn't match expected format: {data}")
                    time.sleep(1)
                    continue
                
                # Send to API
                if working_api_url:
                    try:
                        logging.info(f"📤 Sending data to API: {data}")
                        headers = {'Content-Type': 'application/json'}
                        response = requests.post(
                            working_api_url, 
                            json={"data": data}, 
                            headers=headers,
                            timeout=10
                        )
                        
                        logging.info(f"📥 API response status: {response.status_code}")
                        logging.info(f"📥 API response body: {response.text}")
                        
                        if response.status_code == 201:
                            logging.info("✅ Data successfully sent to API")
                            
                            # Send any cached readings
                            if local_readings:
                                logging.info(f"📤 Sending {len(local_readings)} cached readings")
                                for cached_data in local_readings:
                                    try:
                                        cached_response = requests.post(
                                            working_api_url, 
                                            json={"data": cached_data},
                                            headers=headers,
                                            timeout=10
                                        )
                                        logging.info(f"📥 Cached data sent, status: {cached_response.status_code}")
                                    except Exception as e:
                                        logging.error(f"❌ Failed to send cached data: {str(e)}")
                                        break
                                local_readings = []
                        else:
                            logging.error(f"❌ API error: {response.status_code}")
                            logging.error(response.text)
                    except requests.exceptions.RequestException as e:
                        logging.error(f"❌ Connection error: {str(e)}")
                        logging.info("📝 Storing reading locally")
                        local_readings.append(data)
                        
                        # Check if we need to find a new API URL
                        logging.warning("⚠️ Connection failure, checking for alternative API URL")
                        new_api_url = check_api_connection()
                        if new_api_url:
                            logging.info(f"🔄 Switching to new API URL: {new_api_url}")
                            working_api_url = new_api_url
                else:
                    # Store locally
                    logging.info("📝 API unavailable, storing reading locally")
                    local_readings.append(data)
                    
                    # Periodically check if API is back online
                    if len(local_readings) % 5 == 0:
                        logging.info("🔍 Checking if API is back online...")
                        working_api_url = check_api_connection()
                
                # Wait before next reading
                logging.info(f"⏱️ Waiting {READ_INTERVAL} seconds before next reading")
                time.sleep(READ_INTERVAL)
                
            except serial.SerialException as e:
                logging.error(f"❌ Serial error: {str(e)}")
                logging.info("⚠️ Arduino disconnected or port changed. Attempting to find it again...")
                try:
                    if ser:
                        ser.close()
                    ser = None
                    connection_attempts = 0  # Reset for fresh detection
                    time.sleep(2)
                    
                    # Try to find Arduino again
                    new_port = find_arduino_port()
                    if new_port:
                        serial_port = new_port
                        logging.info(f"✅ Found Arduino on new port: {serial_port}")
                    else:
                        logging.warning("⚠️ Could not find Arduino. Will retry...")
                        time.sleep(5)
                except Exception as reconnect_error:
                    logging.error(f"❌ Failed to reconnect: {str(reconnect_error)}")
                    time.sleep(5)  # Wait before trying again
                
            except Exception as e:
                logging.error(f"❌ Unexpected error: {str(e)}")
                time.sleep(5)
    
    except KeyboardInterrupt:
        logging.info("🛑 Script terminated by user")
    except Exception as e:
        logging.error(f"❌ Unexpected error: {str(e)}")
    finally:
        logging.info("🛑 Shutting down")
        try:
            if ser:
                ser.close()
                logging.info("✅ Serial port closed")
        except:
            pass
        
        # Save any unsent readings to file
        if local_readings:
            logging.info(f"💾 Saving {len(local_readings)} unsent readings to file")
            with open('unsent_readings.json', 'w') as f:
                json.dump(local_readings, f)

if __name__ == "__main__":
    main()
