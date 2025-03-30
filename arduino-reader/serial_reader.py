
#!/usr/bin/env python3
"""
Arduino Serial Reader Service
----------------------------
Standalone service that reads data from Arduino via USB serial
and sends it to the API service via HTTP POST requests.
"""

import serial
import requests
import time
import json
import logging
import os
import sys
import glob
import signal
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('arduino_serial.log')
    ]
)

# Configuration - Can be overridden by environment variables
DEFAULT_SERIAL_PORT = '/dev/ttyUSB0'  # Default fallback
SERIAL_PORT = os.environ.get('ARDUINO_SERIAL_PORT', DEFAULT_SERIAL_PORT)
BAUD_RATE = int(os.environ.get('ARDUINO_BAUD_RATE', '9600'))
API_URL = os.environ.get('API_URL', 'http://api:3001/api/readings')
READ_INTERVAL = float(os.environ.get('READ_INTERVAL', '5'))  # Seconds between readings
RETRY_INTERVAL = float(os.environ.get('RETRY_INTERVAL', '10'))  # Seconds between connection retries

# Alternative API URLs to try if the main one fails
ALTERNATIVE_API_URLS = [
    'http://localhost:3001/api/readings',
    'http://127.0.0.1:3001/api/readings'
]

# Global flag for graceful shutdown
running = True

def signal_handler(sig, frame):
    """Handle SIGINT/SIGTERM for graceful shutdown"""
    global running
    logging.info("🛑 Received shutdown signal, exiting gracefully...")
    running = False

# Register signal handlers
signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

def find_arduino_port():
    """Automatically find Arduino serial port"""
    logging.info("========== ARDUINO DETECTION START ==========")
    logging.info(f"Searching for Arduino on available serial ports...")
    
    # Common patterns for Arduino/CH341 devices
    if sys.platform.startswith('win'):
        ports = list(glob.glob('COM[0-9]*'))
        logging.info(f"Windows detected, checking COM ports: {', '.join(ports) if ports else 'None found'}")
    else:
        # Check for multiple USB ports (USB0-USB3)
        usb_ports = []
        for i in range(4):
            port = f'/dev/ttyUSB{i}'
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

def check_api_connection(url=API_URL):
    """Check if the API is reachable and return working URL"""
    logging.info(f"Checking API connectivity at {url}...")
    
    # First try the provided URL
    try:
        base_url = url.rsplit('/', 1)[0]  # Remove 'readings' to get base URL
        logging.info(f"Testing API URL: {base_url}")
        response = requests.get(base_url, timeout=2)
        if response.status_code == 200:
            logging.info(f"✅ API URL is working: {url}")
            return url
    except requests.exceptions.RequestException as e:
        logging.warning(f"❌ API URL failed: {str(e)}")
    
    # Try alternatives
    for alt_url in ALTERNATIVE_API_URLS:
        try:
            base_url = alt_url.rsplit('/', 1)[0]  # Remove 'readings' to get base URL
            logging.info(f"Testing alternative API URL: {base_url}")
            response = requests.get(base_url, timeout=2)
            if response.status_code == 200:
                logging.info(f"✅ Alternative API URL is working: {alt_url}")
                return alt_url
        except requests.exceptions.RequestException as e:
            logging.warning(f"❌ Alternative API URL failed: {str(e)}")
    
    logging.error("❌ All API URLs failed. Cannot connect to API server.")
    return None

def send_data_to_api(data, api_url):
    """Send data to the API endpoint"""
    try:
        logging.info(f"📤 Sending data to API: {data}")
        headers = {'Content-Type': 'application/json'}
        response = requests.post(
            api_url, 
            json={"data": data}, 
            headers=headers,
            timeout=10
        )
        
        logging.info(f"📥 API response status: {response.status_code}")
        if response.text:
            logging.info(f"📥 API response body: {response.text}")
        
        if response.status_code == 201:
            logging.info("✅ Data successfully sent to API")
            return True
        else:
            logging.error(f"❌ API error: {response.status_code}")
            if response.text:
                logging.error(response.text)
            return False
    except requests.exceptions.RequestException as e:
        logging.error(f"❌ Connection error: {str(e)}")
        return False

def main():
    global running
    
    logging.info("=" * 80)
    logging.info(f"🚀 STARTING ARDUINO SENSOR READER SERVICE")
    logging.info(f"⚙️ Configuration:")
    logging.info(f"  - Default port: {DEFAULT_SERIAL_PORT}")
    logging.info(f"  - Environment port: {SERIAL_PORT}")
    logging.info(f"  - Baud rate: {BAUD_RATE}")
    logging.info(f"  - Read interval: {READ_INTERVAL} seconds")
    logging.info(f"  - API URL: {API_URL}")
    logging.info("=" * 80)
    
    # Auto-detect Arduino port if not specified correctly
    serial_port = SERIAL_PORT
    if not os.path.exists(serial_port):
        logging.warning(f"⚠️ Specified port {serial_port} not found, attempting auto-detection")
        serial_port = find_arduino_port()
    
    if not serial_port:
        logging.error(f"❌ No Arduino port detected. Service cannot start.")
        return 1
    
    # Check for API connectivity
    working_api_url = check_api_connection()
    if not working_api_url:
        logging.error("❌ Could not connect to API. Service will retry periodically.")
    
    # Local storage for readings if API is unreachable
    local_readings = []
    
    # Main loop
    ser = None
    connection_attempts = 0
    max_connection_attempts = 10
    
    while running:
        try:
            # Connect to Arduino if not connected
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
            
            # If API URL is not available, check again
            if not working_api_url:
                working_api_url = check_api_connection()
            
            # Send to API if we have a working URL
            if working_api_url:
                if send_data_to_api(data, working_api_url):
                    # If we have cached readings, try to send them too
                    if local_readings:
                        logging.info(f"📤 Sending {len(local_readings)} cached readings")
                        successful_sends = []
                        for idx, cached_data in enumerate(local_readings):
                            if send_data_to_api(cached_data, working_api_url):
                                successful_sends.append(idx)
                            else:
                                # If sending fails, stop trying to send cached readings
                                break
                        
                        # Remove successfully sent readings
                        local_readings = [r for i, r in enumerate(local_readings) if i not in successful_sends]
                        if local_readings:
                            logging.info(f"⚠️ Still have {len(local_readings)} cached readings to send")
                        else:
                            logging.info("✅ All cached readings sent successfully")
                else:
                    # If sending fails, cache the reading and check API URL
                    logging.warning("⚠️ Failed to send data, caching locally")
                    local_readings.append(data)
                    working_api_url = check_api_connection()
            else:
                # Store locally since we don't have a working API URL
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
            logging.info("⚠️ Arduino disconnected or port changed. Attempting to reconnect...")
            try:
                if ser:
                    ser.close()
                ser = None
                time.sleep(2)
            except Exception as close_error:
                logging.error(f"❌ Error closing serial port: {str(close_error)}")
            
        except KeyboardInterrupt:
            running = False
            logging.info("🛑 Received keyboard interrupt, shutting down...")
            
        except Exception as e:
            logging.error(f"❌ Unexpected error: {str(e)}")
            time.sleep(5)
    
    # Cleanup
    logging.info("🛑 Shutting down Arduino reader service")
    try:
        if ser:
            ser.close()
            logging.info("✅ Serial port closed")
    except Exception as e:
        logging.error(f"❌ Error closing serial port: {str(e)}")
    
    # Save any unsent readings to file
    if local_readings:
        logging.info(f"💾 Saving {len(local_readings)} unsent readings to file")
        with open('unsent_readings.json', 'w') as f:
            json.dump(local_readings, f)
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
