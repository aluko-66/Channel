# Velora TSE — Practical Debugging Exercise #2

A Node.js + SQLite shopping cart API with **3 new bugs** to diagnose and fix.

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Seed the database (run once)
node db/seed.js

# 3. Start the server
npm start
# → http://localhost:3000
```

---

## The Scenario

> **Support ticket from a customer:**
>
> *"The product search is totally broken — typing any keyword returns zero results, unless you type the exact full product name. Also, when I add the same item to my cart twice, the quantity shows something like '21' instead of 3. And when I try to remove an item from my cart, it either removes the wrong thing or says the item wasn't found."*

Your job:
1. Reproduce each issue using the browser UI at `http://localhost:3000`
2. Identify the root cause by reading the code and logs
3. Describe (or implement) your fix

---

## What's Available

| Path | Description |
|------|-------------|
| `src/server.js` | Express API — all route handlers |
| `src/database.js` | SQLite connection |
| `src/logger.js` | File-based logger |
| `db/seed.js` | Seeds the database |
| `db/velora2.db` | SQLite database (created after seeding) |
| `logs/app.log` | Application logs |
| `public/index.html` | Browser UI to test the API |

---

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/products` | List all products |
| GET | `/api/products/search?name=xxx` | Search products by name |
| POST | `/api/cart` | Add item to cart |
| GET | `/api/cart/:user_id` | Get cart for a user |
| DELETE | `/api/cart/:user_id/:product_id` | Remove item from cart |

---

## Bugs Hidden in This App

<details>
<summary>🔍 Spoilers — only open after you've investigated!</summary>

### Bug 1 — Missing LIKE wildcards (`GET /api/products/search` → always 0 results for partial terms)

**File:** `src/server.js` line ~34  
**Root cause:** The SQL query does `WHERE name LIKE ?` and passes the raw search string.  
Without `%` wildcards, `LIKE` behaves identically to `=` — only exact full-name matches work.  
The logs confirm it: `Search for "mouse" returned 0 results` but `Search for "Ergonomic Mouse" returned 1 results`.

**Fix:**
```js
// Change:
.all(name);
// To:
.all(`%${name}%`);
```

---

### Bug 2 — String concatenation instead of numeric addition (`POST /api/cart` → quantity becomes "21" not 3)

**File:** `src/server.js` line ~58  
**Root cause:** `quantity` arrives from `req.body` as a JavaScript string (e.g. `"2"`).  
When an existing cart row is found, the update does `existing.quantity + quantity` —  
string + string concatenation produces `"21"` instead of `3`.

**Fix:**
```js
// At the top of the route handler, parse quantity:
const qty = parseInt(quantity, 10);

// Then use qty everywhere:
const line_total = product.price * qty;
.run(existing.quantity + qty, user_id, product_id);
.run(user_id, product_id, qty, line_total);
```

---

### Bug 3 — Swapped parameters in DELETE (`DELETE /api/cart/:user_id/:product_id` → deletes wrong row or 404)

**File:** `src/server.js` line ~82  
**Root cause:** The `.run()` call passes `product_id` first and `user_id` second,  
but the SQL placeholder order is `WHERE user_id = ? AND product_id = ?`.  
So it tries to delete WHERE `user_id = product_id AND product_id = user_id` — wrong row every time.

**Fix:**
```js
// Change:
.run(product_id, user_id);
// To:
.run(user_id, product_id);
```

</details>
