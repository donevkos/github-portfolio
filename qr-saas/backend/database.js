const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("database.db");

db.serialize(()=>{

db.run(`
CREATE TABLE IF NOT EXISTS users(
id INTEGER PRIMARY KEY AUTOINCREMENT,
email TEXT UNIQUE,
password TEXT,
plan TEXT DEFAULT 'free'
)
`);

db.run(`
CREATE TABLE IF NOT EXISTS qrcodes(
id INTEGER PRIMARY KEY AUTOINCREMENT,
user_id INTEGER,
code TEXT UNIQUE,
target_url TEXT,
scans INTEGER DEFAULT 0
)
`);

});

module.exports = db;