
const express = require('express');
const cors = require('cors');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const morgan = require('morgan');
const path = require('path');

// Create data directory if it doesn't exist
const fs = require('fs');
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

// Setup the database
const adapter = new FileSync(path.join(__dirname, 'data', 'db.json'));
const db = low(adapter);
db.defaults({ readings: [] }).write();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// Enhanced logging middleware - log all requests and their bodies
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} from ${req.ip}`);
  console.log(`[${new Date().toISOString()}] Headers: ${JSON.stringify(req.headers)}`);
  
  if (req.method === 'POST' || req.method === 'PUT') {
    console.log(`[${new Date().toISOString()}] Request body: ${JSON.stringify(req.body)}`);
  }
  
  // Add response logging
  const originalSend = res.send;
  res.send = function(data) {
    console.log(`[${new Date().toISOString()}] Response status: ${res.statusCode}`);
    return originalSend.call(this, data);
  };
  
  next();
});

// Parse Arduino data string
const parseArduinoData = (dataString) => {
  try {
    console.log(`[${new Date().toISOString()}] Parsing data: ${dataString}`);
    // Sample format: pH:6.20,temp:23.20,water:medium,tds:652
    const parts = dataString.split(',');
    
    if (parts.length < 4) {
      console.error(`[${new Date().toISOString()}] Invalid data format: insufficient parts, expected 4, got ${parts.length}`);
      console.error(`[${new Date().toISOString()}] Data string: ${dataString}`);
      return null;
    }
    
    // More robust parsing with validation
    const pHPart = parts[0].split(':');
    const tempPart = parts[1].split(':');
    const waterPart = parts[2].split(':');
    const tdsPart = parts[3].split(':');
    
    if (pHPart.length !== 2 || tempPart.length !== 2 || waterPart.length !== 2 || tdsPart.length !== 2) {
      console.error(`[${new Date().toISOString()}] Invalid data format: one or more parts don't have key:value format`);
      console.error(`[${new Date().toISOString()}] Data string: ${dataString}`);
      return null;
    }
    
    if (pHPart[0] !== 'pH' || tempPart[0] !== 'temp' || waterPart[0] !== 'water' || tdsPart[0] !== 'tds') {
      console.error(`[${new Date().toISOString()}] Invalid data format: unexpected keys`);
      console.error(`[${new Date().toISOString()}] Expected: pH, temp, water, tds`);
      console.error(`[${new Date().toISOString()}] Got: ${pHPart[0]}, ${tempPart[0]}, ${waterPart[0]}, ${tdsPart[0]}`);
      return null;
    }
    
    const pH = parseFloat(pHPart[1]);
    const temp = parseFloat(tempPart[1]);
    const water = waterPart[1];
    const tds = parseInt(tdsPart[1]);
    
    // Validate numeric values
    if (isNaN(pH) || isNaN(temp) || isNaN(tds)) {
      console.error(`[${new Date().toISOString()}] Invalid data: non-numeric values`);
      console.error(`[${new Date().toISOString()}] pH: ${pHPart[1]}, temp: ${tempPart[1]}, tds: ${tdsPart[1]}`);
      return null;
    }
    
    const parsedData = { 
      pH, 
      temp, 
      water, 
      tds,
      timestamp: Date.now()
    };
    
    console.log(`[${new Date().toISOString()}] Parsed data:`, JSON.stringify(parsedData));
    return parsedData;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error parsing Arduino data:`, error);
    console.error(`[${new Date().toISOString()}] Original data string: "${dataString}"`);
    return null;
  }
};

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Water Quality Monitoring API' });
});

// Get all readings
app.get('/api/readings', (req, res) => {
  const readings = db.get('readings').value();
  console.log(`[${new Date().toISOString()}] Returning ${readings.length} readings`);
  res.json(readings);
});

// Get latest reading
app.get('/api/readings/latest', (req, res) => {
  const readings = db.get('readings').value();
  if (readings.length === 0) {
    console.log(`[${new Date().toISOString()}] No readings available`);
    return res.status(404).json({ error: 'No readings available' });
  }
  console.log(`[${new Date().toISOString()}] Returning latest reading`);
  res.json(readings[readings.length - 1]);
});

// Add new reading
app.post('/api/readings', (req, res) => {
  try {
    const { data } = req.body;
    
    console.log(`[${new Date().toISOString()}] Received new reading data: ${data}`);
    
    if (!data) {
      console.error(`[${new Date().toISOString()}] No data provided in request body`);
      console.error(`[${new Date().toISOString()}] Request body: ${JSON.stringify(req.body)}`);
      return res.status(400).json({ error: 'No data provided' });
    }
    
    const parsedData = parseArduinoData(data);
    
    if (!parsedData) {
      console.error(`[${new Date().toISOString()}] Invalid data format`);
      return res.status(400).json({ error: 'Invalid data format' });
    }
    
    db.get('readings')
      .push(parsedData)
      .write();
    
    // Keep only the last 100 readings
    const readings = db.get('readings').value();
    if (readings.length > 100) {
      db.set('readings', readings.slice(-100)).write();
    }
    
    console.log(`[${new Date().toISOString()}] Added new reading:`, JSON.stringify(parsedData));
    res.status(201).json(parsedData);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error adding reading:`, error);
    res.status(500).json({ error: 'Failed to add reading' });
  }
});

// Testing endpoint - allows sending test data without an Arduino
app.get('/api/test', (req, res) => {
  console.log(`[${new Date().toISOString()}] Test endpoint called`);
  const testData = {
    pH: 6.8,
    temp: 24.5,
    water: 'medium',
    tds: 450,
    timestamp: Date.now()
  };
  
  db.get('readings')
    .push(testData)
    .write();
  
  console.log(`[${new Date().toISOString()}] Added test reading:`, JSON.stringify(testData));
  res.status(200).json({ message: 'Test data added', data: testData });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[${new Date().toISOString()}] API server running on port ${PORT}`);
  console.log(`[${new Date().toISOString()}] Server listening on all interfaces (0.0.0.0)`);
  console.log(`[${new Date().toISOString()}] Database initialized with ${db.get('readings').size().value()} readings`);
});
