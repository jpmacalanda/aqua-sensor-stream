
FROM python:3.10-slim

WORKDIR /app

# Install required packages
RUN apt-get update && apt-get install -y \
    udev \
    libusb-1.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the service script
COPY serial_reader.py .

# Make the script executable
RUN chmod +x serial_reader.py

# Run with Python unbuffered output for better logging
CMD ["python", "-u", "serial_reader.py"]
