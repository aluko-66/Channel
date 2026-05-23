// src/server.js
const express = require("express");
const path = require("path");
const db = require("./database");
const logger = require("./logger");
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// ─── ROUTES ────────────────────────────────────────────────────────────────

// GET /api/products — list all products
app.get("/api/products", (req, res) => {
  try {
    const products = db.prepare("SELECT * FROM products").all();
    logger.info(`Fetched ${products.length} products`);
    res.json(products);
  } catch (err) {
    logger.error("Failed to fetch products: " + err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/products/search?name=xxx — search products by name
// BUG 1: LIKE pattern is missing wildcards — exact match only, never returns results
app.get("/api/products/search", (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: "Missing name query param" });

  try {
    // ❌ Should be: LIKE '%' || ? || '%'  (wildcards required for partial match)
    const results = db
      .prepare("SELECT * FROM products WHERE name LIKE '%' || ? || '%'")
      .all(`%${name}%`);  // passes raw name — no wildcards, behaves like exact match

    logger.info(`Search for "${name}" returned ${results.length} results`);
    res.json(results);
  } catch (err) {
    logger.error("Product search failed: " + err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/cart — add item to a user's cart
// BUG 2: quantity is parsed as a string, not a number — arithmetic produces NaN / wrong totals
app.post("/api/cart", (req, res) => {
  const { user_id, product_id, quantity } = req.body;
   const qty = parseInt(quantity, 10);
  if (!user_id || !product_id || !quantity) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const product = db.prepare("SELECT * FROM products WHERE id = ?").get(product_id);
    if (!product) return res.status(404).json({ error: "Product not found" });

    // ❌ quantity comes in as a string from JSON body — multiplication may still work
    // but the stored value is a string, and the line_total calculation is wrong:
    const line_total = product.price * qty;  // works only because JS coerces
    // The real bug: quantity is stored as TEXT in SQLite due to no parseInt/parseFloat
    // which breaks any SUM(quantity) queries later

    const existing = db
      .prepare("SELECT * FROM cart WHERE user_id = ? AND product_id = ?")
      .get(user_id, product_id);

    if (existing) {
      // ❌ string + number concatenation instead of numeric addition
      db.prepare("UPDATE cart SET quantity = ? WHERE user_id = ? AND product_id = ?")
        .run(existing.quantity + qty, user_id, product_id); // "2" + "1" = "21" not 3
    } else {
      db.prepare(
        "INSERT INTO cart (user_id, product_id, quantity, line_total) VALUES (?, ?, ?, ?)"
      ).run(user_id, product_id, qty, line_total);
    }

    logger.info(`Cart updated for user ${user_id}, product ${product_id}`);
    res.status(200).json({ message: "Cart updated", line_total });
  } catch (err) {
    logger.error("Cart update failed: " + err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/cart/:user_id — get cart summary for a user
app.get("/api/cart/:user_id", (req, res) => {
  try {
    const items = db
      .prepare(
        `SELECT cart.*, products.name, products.price
         FROM cart
         JOIN products ON cart.product_id = products.id
         WHERE cart.user_id = ?`
      )
      .all(req.params.user_id);

    const total = items.reduce((sum, item) => sum + item.line_total, 0);
    res.json({ items, total });
  } catch (err) {
    logger.error("Cart fetch failed: " + err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/cart/:user_id/:product_id — remove item from cart
// BUG 3: user_id and product_id are swapped in the WHERE clause — deletes wrong row
app.delete("/api/cart/:user_id/:product_id", (req, res) => {
  const { user_id, product_id } = req.params;

  try {
    // ❌ Parameters are swapped — deletes WHERE user_id=product_id AND product_id=user_id
    const result = db
      .prepare("DELETE FROM cart WHERE user_id = ? AND product_id = ?")
      .run( user_id, product_id); // ❌ reversed order

    if (result.changes === 0) {
      logger.warn(`Cart item not found: user=${user_id} product=${product_id}`);
      return res.status(404).json({ error: "Item not found in cart" });
    }

    logger.info(`Removed product ${product_id} from cart of user ${user_id}`);
    res.json({ message: "Item removed" });
  } catch (err) {
    logger.error("Cart delete failed: " + err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── START ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT}`);
  console.log(`\n🚀 App running at http://localhost:${PORT}\n`);
});
