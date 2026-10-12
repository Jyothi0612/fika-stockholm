// menu service: the cafés and what they sell. Reads MongoDB (database "menu").
const express = require('express');
const { MongoClient } = require('mongodb');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/menu';
const PORT = process.env.PORT || 8080;
const log = (level, msg, extra = {}) => console.log(JSON.stringify({ time: new Date().toISOString(), level, msg, service: 'menu', ...extra }));

let db = null;
async function connect() {
  try {
    const client = new MongoClient(MONGO_URL, { serverSelectionTimeoutMS: 3000 });
    await client.connect();
    db = client.db();
    log('INFO', 'connected to MongoDB', { url: MONGO_URL.replace(/\/\/.*@/, '//') });
  } catch (e) {
    log('ERROR', 'MongoDB not reachable, retrying in 5s', { error: e.message });
    setTimeout(connect, 5000);
  }
}

const app = express();
app.use((req, res, next) => {
  const t0 = Date.now(), id = req.get('x-request-id') || '';
  res.on('finish', () => log('INFO', `${req.method} ${req.originalUrl} ${res.statusCode}`, { requestId: id, ms: Date.now() - t0 }));
  next();
});
const ready = (res) => { if (!db) { res.status(503).json({ message: 'database unavailable' }); return false; } return true; };

app.get('/health', async (req, res) => {
  let mongo = false;
  try { if (db) { await db.command({ ping: 1 }); mongo = true; } } catch (_) {}
  res.status(mongo ? 200 : 503).json({ app: 'OK', mongo });
});

app.get('/cafes', async (req, res) => {
  if (!ready(res)) return;
  res.json(await db.collection('cafes').find({}, { projection: { _id: 0 } }).sort({ name: 1 }).toArray());
});

app.get('/cafes/:id', async (req, res) => {
  if (!ready(res)) return;
  const cafe = await db.collection('cafes').findOne({ id: req.params.id }, { projection: { _id: 0 } });
  cafe ? res.json(cafe) : res.status(404).json({ message: 'cafe not found' });
});

app.get('/cafes/:id/items', async (req, res) => {
  if (!ready(res)) return;
  res.json(await db.collection('items').find({ cafe: req.params.id }, { projection: { _id: 0 } }).sort({ category: 1, name: 1 }).toArray());
});

app.get('/item/:sku', async (req, res) => {
  if (!ready(res)) return;
  const item = await db.collection('items').findOne({ sku: req.params.sku }, { projection: { _id: 0 } });
  item ? res.json(item) : res.status(404).json({ message: 'item not found' });
});

app.get('/search/:text', async (req, res) => {
  if (!ready(res)) return;
  const rx = new RegExp(req.params.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  res.json(await db.collection('items').find({ $or: [{ name: rx }, { description: rx }] }, { projection: { _id: 0 } }).toArray());
});

app.use((req, res) => res.status(404).json({ message: `route ${req.method} ${req.path} not found` }));

connect();
app.listen(PORT, () => log('INFO', `listening on ${PORT}`));
