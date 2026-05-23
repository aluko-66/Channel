// db/seed.js — run once: node db/seed.js
const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "velora2.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price REAL NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS cart (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    line_total REAL NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

const insertUser = db.prepare("INSERT OR IGNORE INTO users (name, email) VALUES (?, ?)");
insertUser.run("Dana Lee", "dana@example.com");
insertUser.run("Evan Park", "evan@example.com");
insertUser.run("Fiona Ray", "fiona@example.com");

const insertProduct = db.prepare(
  "INSERT INTO products (name, category, price, stock) VALUES (?, ?, ?, ?)"
);
insertProduct.run("Ergonomic Mouse",    "Peripherals", 45.99,  120);
insertProduct.run("Laptop Stand",       "Accessories", 34.99,  80);
insertProduct.run("Blue Light Glasses", "Wellness",    29.99,  200);
insertProduct.run("Desk Lamp LED",      "Lighting",    59.99,  60);
insertProduct.run("Noise-Cancel Buds",  "Audio",       89.99,  45);

console.log("✅ Database seeded successfully.");
db.close();
