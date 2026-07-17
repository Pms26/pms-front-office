require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/rooms', require('./routes/rooms'));
app.use('/api/checkin', require('./routes/checkin'));
app.use('/api/checkout', require('./routes/checkout'));
app.use('/api/folios', require('./routes/folios'));

app.get('/', (req, res) => {
  res.json({ service: 'Front Office', status: 'running', port: process.env.PORT });
});

app.post('/api/seed', async (req, res) => {
  try {
    const seed = require('./seed');
    await seed();
    res.json({ message: 'Seed terminé avec succès' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4005;

const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Front Office service démarré sur le port ${PORT}`);
  });
};

start();
