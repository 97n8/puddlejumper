'use strict';
require('dotenv').config();
const path     = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || './data/logicos.db';
let _db = null;

function getDb() {
  if (_db) return _db;
  const dir = require('path').dirname(DB_PATH);
  const fs  = require('fs');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  _db.pragma('busy_timeout = 5000');
  return _db;
}

function queryAll(sql, params = []) {
  return getDb().prepare(sql).all(...params);
}

function queryOne(sql, params = []) {
  return getDb().prepare(sql).get(...params);
}

function queryRun(sql, params = []) {
  return getDb().prepare(sql).run(...params);
}

function transaction(fn) {
  return getDb().transaction(fn)();
}

module.exports = { getDb, queryAll, queryOne, queryRun, transaction };
