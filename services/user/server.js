// user service: guest IDs (Redis), accounts and order history (MongoDB, database "users").
const express = require('express');
const bcrypt = require('bcryptjs');
const { MongoClient } = require('mongodb');
const { createClient } = require('redis');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/users';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const PORT = process.env.PORT || 8080;
const log = (level, msg, extra = {}) => console.log(JSON.stringify({ time: new Date().toISOString(), level, msg, service: 'user', ...extra }));

let db = null;
async function connectMongo() {
  try {
    const c = new MongoClient(MONGO_URL, { serverSelectionTimeoutMS: 3000 });
    await c.connect(); db = c.db();
    await db.collection('users').createIndex({ name: 1 }, { unique: true });
    log('INFO', 'connected to MongoDB');
  } catch (e) { log('ERROR', 'MongoDB not reachable, retrying in 5s', { error: e.message }); setTimeout(connectMongo, 5000); }
}
const redis = createClient({ url: REDIS_URL, socket: { reconnectStrategy: () => 5000 } });
redis.on('error', e => log('ERROR', 'Redis error', { error: e.message }));
redis.on('ready', () => log('INFO', 'connected to Redis'));

const app = express();
app.use(express.json({ limit: '10kb' }));
app.use((req, res, next) => {
  const t0 = Date.now(), id = req.get('x-request-id') || '';
  res.on('finish', () => log('INFO', `${req.method} ${req.originalUrl} ${res.statusCode}`, { requestId: id, ms: Date.now() - t0 }));
  next();
});

app.get('/health', async (req, res) => {
  let mongo = false, rds = false;
  try { if (db) { await db.command({ ping: 1 }); mongo = true; } } catch (_) {}
  try { rds = redis.isReady && (await redis.ping()) === 'PONG'; } catch (_) {}
  res.status(mongo && rds ? 200 : 503).json({ app: 'OK', mongo, redis: rds });
});

// a guest gets a number before logging in, so the basket has a key: guest-1, guest-2, ...
app.get('/uniqueid', async (req, res) => {
  try { const n = await redis.incr('guest-counter'); res.json({ uuid: `guest-${n}` }); }
  catch (e) { res.status(503).json({ message: 'redis unavailable', error: e.message }); }
});

app.post('/register', async (req, res) => {
  if (!db) return res.status(503).json({ message: 'database unavailable' });
  const { name, email, password } = req.body || {};
  if (!name || !email || !password || password.length < 6) return res.status(400).json({ message: 'name, email and a password of 6+ characters are required' });
  try {
    await db.collection('users').insertOne({ name, email, hash: await bcrypt.hash(password, 10), created: new Date() });
    res.status(201).json({ name, email });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ message: 'that name is taken' });
    res.status(500).json({ message: 'could not register', error: e.message });
  }
});

app.post('/login', async (req, res) => {
  if (!db) return res.status(503).json({ message: 'database unavailable' });
  const { name, password } = req.body || {};
  const user = await db.collection('users').findOne({ name });
  if (!user || !(await bcrypt.compare(password || '', user.hash))) return res.status(401).json({ message: 'wrong name or password' });
  res.json({ name: user.name, email: user.email });
});

// used by payment
app.get('/check/:name', async (req, res) => {
  if (!db) return res.status(503).json({ message: 'database unavailable' });
  (await db.collection('users').findOne({ name: req.params.name })) ? res.json({ ok: true }) : res.status(404).json({ message: 'user not found' });
});

app.post('/order/:name', async (req, res) => {
  if (!db) return res.status(503).json({ message: 'database unavailable' });
  await db.collection('orders').updateOne({ name: req.params.name }, { $push: { history: { ...req.body, at: new Date() } } }, { upsert: true });
  res.status(201).json({ ok: true });
});

// used by the kitchen: paid -> preparing -> ready (pickup code) or on the way (ETA)
app.put('/order/:name/:orderid/status', async (req, res) => {
  if (!db) return res.status(503).json({ message: 'database unavailable' });
  const { status, pickupCode, etaMinutes } = req.body || {};
  if (!status) return res.status(400).json({ message: 'status is required' });
  const set = { 'history.$.status': status, 'history.$.updated': new Date() };
  if (pickupCode) set['history.$.pickupCode'] = pickupCode;
  if (etaMinutes != null) set['history.$.etaMinutes'] = etaMinutes;
  const r = await db.collection('orders').updateOne({ name: req.params.name, 'history.orderid': req.params.orderid }, { $set: set });
  r.matchedCount ? res.json({ ok: true }) : res.status(404).json({ message: 'order not found' });
});

app.get('/order/:name/:orderid', async (req, res) => {
  if (!db) return res.status(503).json({ message: 'database unavailable' });
  const doc = await db.collection('orders').findOne({ name: req.params.name }, { projection: { history: { $elemMatch: { orderid: req.params.orderid } } } });
  const o = doc && doc.history && doc.history[0];
  o ? res.json(o) : res.status(404).json({ message: 'order not found' });
});

app.get('/history/:name', async (req, res) => {
  if (!db) return res.status(503).json({ message: 'database unavailable' });
  const doc = await db.collection('orders').findOne({ name: req.params.name });
  res.json((doc && doc.history || []).reverse());
});

app.use((req, res) => res.status(404).json({ message: `route ${req.method} ${req.path} not found` }));

connectMongo();
redis.connect().catch(e => log('ERROR', 'Redis not reachable', { error: e.message }));
app.listen(PORT, () => log('INFO', `listening on ${PORT}`));
