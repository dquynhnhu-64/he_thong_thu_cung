require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const client = require('prom-client'); // Tích hợp Prometheus metrics

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Cấu hình Prometheus Metrics
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ register: client.register });

// Tạo custom metric đếm số lượng HTTP requests
const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Tổng số lượt truy cập HTTP Requests',
  labelNames: ['method', 'route', 'status']
});

// Middleware ghi nhận log và đếm request cho Prometheus
app.use((req, res, next) => {
  res.on('finish', () => {
    httpRequestCounter.inc({
      method: req.method,
      route: req.route ? req.route.path : req.path,
      status: res.statusCode
    });
  });
  next();
});

// Khởi tạo kết nối PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'petshop_db',
});

// ================= 1. QUẢN LÝ THÚ CƯNG =================
app.get('/api/pets', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM pets ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/pets', async (req, res) => {
  const { name, type, price, customer_id } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO pets (name, type, price, customer_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, type, price, customer_id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= 2. QUẢN LÝ KHÁCH HÀNG =================
app.get('/api/customers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM customers ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/customers', async (req, res) => {
  const { name, phone, email } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO customers (name, phone, email) VALUES ($1, $2, $3) RETURNING *',
      [name, phone, email]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= 3. QUẢN LÝ DỊCH VỤ SPA =================
app.get('/api/services', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM services ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= 4. QUẢN LÝ LỊCH HẸN SPA =================
app.get('/api/appointments', async (req, res) => {
  try {
    const query = `
      SELECT a.id, p.name AS pet_name, c.name AS customer_name, s.name AS service_name, 
             a.appointment_date, a.status 
      FROM appointments a
      LEFT JOIN pets p ON a.pet_id = p.id
      LEFT JOIN customers c ON p.customer_id = c.id
      LEFT JOIN services s ON a.service_id = s.id
      ORDER BY a.id DESC`;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/appointments', async (req, res) => {
  const { pet_id, service_id, appointment_date } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO appointments (pet_id, service_id, appointment_date) VALUES ($1, $2, $3) RETURNING *',
      [pet_id, service_id, appointment_date || new Date()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= 5. METRICS & HEALTHCHECK FOR PROMETHEUS =================
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

app.get('/health', (req, res) => res.status(200).send('OK'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server Quản lý Thú Cưng đang chạy liên tục tại: http://localhost:${PORT}`);
});