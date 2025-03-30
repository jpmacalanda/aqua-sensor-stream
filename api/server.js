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

// Parse Arduino data string
const parseArduinoData = (dataString) => {
  try {
    // Sample format: pH:6.20,temp:23.20,water:medium,tds:652
    const parts = dataString.split(',');
    
    const pH = parseFloat(parts[0].split(':')[1]);
    const temp = parseFloat(parts[1].split(':')[1]);
    const water = parts[2].split(':')[1];
    const tds = parseInt(parts[3].split(':')[1]);
    
    return { 
      pH, 
      temp, 
      water, 
      tds,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Error parsing Arduino data:', error);
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
  res.json(readings);
});

// Get latest reading
app.get('/api/readings/latest', (req, res) => {
  const readings = db.get('readings').value();
  if (readings.length === 0) {
    return res.status(404).json({ error: 'No readings available' });
  }
  res.json(readings[readings.length - 1]);
});

// Add new reading
app.post('/api/readings', (req, res) => {
  try {
    const { data } = req.body;
    
    if (!data) {
      return res.status(400).json({ error: 'No data provided' });
    }
    
    const parsedData = parseArduinoData(data);
    
    if (!parsedData) {
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
    
    console.log('Added new reading:', parsedData);
    res.status(201).json(parsedData);
  } catch (error) {
    console.error('Error adding reading:', error);
    res.status(500).json({ error: 'Failed to add reading' });
  }
});

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});
