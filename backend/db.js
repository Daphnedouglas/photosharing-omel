require("dotenv").config();
const { Pool } = require("pg");

const sslEnabled = String(process.env.DB_SSL || "").toLowerCase() === "true";

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: sslEnabled ? { rejectUnauthorized: false } : false,
});

module.exports = { pool };
