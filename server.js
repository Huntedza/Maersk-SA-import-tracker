// server.js
console.log('Server script starting...');

const express = require('express');
const cors = require('cors');

async function startServer() {
  console.log('startServer function called.');
  try {
    // Dynamically import ES Modules
    let Low, JSONFile;
    try {
      console.log('Attempting to dynamically import lowdb...');
      ({ Low } = await import('lowdb'));
      ({ JSONFile } = await import('lowdb/node'));
      console.log('Successfully imported lowdb modules.');
    } catch (importError) {
      console.error('FATAL: Failed to import lowdb. Please ensure you have run `npm install`.', importError);
      process.exit(1);
    }

    const app = express();
    const port = 3002;

    // Middleware
    console.log('Configuring middleware...');
    app.use(cors());
    app.use(express.json({ limit: '10mb' })); // Increase payload limit for large schedule data
    app.use(express.urlencoded({ limit: '10mb', extended: true }));
    console.log('Middleware configured.');

    // Default data structure
    const defaultData = { schedules: [] };

    // Database setup
    let db;
    try {
      console.log('Setting up database adapter...');
      const adapter = new JSONFile('db.json');
      db = new Low(adapter, defaultData);
      console.log('Database adapter and instance created.');

      // Initialize database
      console.log('Initializing database file...');
      await db.read();
      await db.write();
      console.log('Database initialized successfully.');
    } catch (dbError) {
      console.error('FATAL: Failed to initialize database.', dbError);
      process.exit(1);
    }

    // --- API Endpoints ---
    console.log('Setting up API endpoints...');

    app.get('/api/schedules', async (req, res) => {
      await db.read();
      if (!db.data.schedules || db.data.schedules.length === 0) {
        return res.json(null);
      }
      res.json(db.data.schedules[0].data);
    });

    app.post('/api/schedules', async (req, res) => {
      try {
        const scheduleData = req.body;
        const scheduleEntry = {
          id: new Date().toISOString(),
          fetchDate: new Date().toISOString(),
          data: scheduleData,
        };
        db.data.schedules = [scheduleEntry];
        await db.write();
        res.status(201).json({ message: 'Schedules saved' });
      } catch (error) {
        console.error('Error saving schedules:', error);
        res.status(500).json({ error: 'Failed to save schedules' });
      }
    });

    app.delete('/api/schedules', async (req, res) => {
      try {
        db.data = { schedules: [] };
        await db.write();
        res.status(200).json({ message: 'Schedules cleared' });
      } catch (error) {
        console.error('Error clearing schedules:', error);
        res.status(500).json({ error: 'Failed to clear schedules' });
      }
    });

    console.log('API endpoints configured.');

    app.listen(port, () => {
      console.log(`🚀 Server running at http://localhost:${port}`);
    });

  } catch (error) {
    console.error('An unexpected error occurred during server startup:', error);
    process.exit(1);
  }
}

startServer();
