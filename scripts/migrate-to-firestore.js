/*
  Migration: MySQL → Firestore
  Run: npm run migrate:firestore

  Required env:
    - VITE_MYSQL_HOST, VITE_MYSQL_USER, VITE_MYSQL_PASSWORD, VITE_MYSQL_DATABASE
    - GOOGLE_APPLICATION_CREDENTIALS (path to Firebase service account JSON) OR use application default credentials

  Notes:
    - This script reads from MySQL and writes to Firestore using firebase-admin.
    - It is idempotent for upsert operations (set with merge).
*/

import 'dotenv/config';
import mysql from 'mysql2/promise';
import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

function resolveServiceAccount() {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath && fs.existsSync(credPath)) {
    const json = JSON.parse(fs.readFileSync(credPath, 'utf8'));
    return cert(json);
  }
  return applicationDefault();
}

function getMysqlPool() {
  const pool = mysql.createPool({
    host: process.env.VITE_MYSQL_HOST || 'localhost',
    user: process.env.VITE_MYSQL_USER || 'root',
    password: process.env.VITE_MYSQL_PASSWORD || '',
    database: process.env.VITE_MYSQL_DATABASE || 'pos_inventory',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
  return pool;
}

async function migrateCategories(pool, db) {
  console.log('Migrating categories...');
  const [rows] = await pool.execute('SELECT name, description FROM categories');
  let count = 0;
  for (const row of rows) {
    const id = row.name;
    await db.collection('categories').doc(id).set({
      name: row.name,
      description: row.description || '',
      migratedAt: new Date()
    }, { merge: true });
    count++;
  }
  console.log(`Categories migrated: ${count}`);
}

async function migrateProducts(pool, db) {
  console.log('Migrating products...');
  const [rows] = await pool.execute(
    'SELECT id, name, description, category_name, price, cost_price, quantity, low_stock_threshold, barcode, image_url FROM products'
  );
  let count = 0;
  for (const row of rows) {
    await db.collection('products').doc(row.id).set({
      name: row.name,
      description: row.description || '',
      category_name: row.category_name || '',
      price: Number(row.price) || 0,
      costPrice: Number(row.cost_price) || 0,
      quantity: Number(row.quantity) || 0,
      lowStockThreshold: Number(row.low_stock_threshold) || 10,
      barcode: row.barcode || '',
      imageUrl: row.image_url || '',
      migratedAt: new Date()
    }, { merge: true });
    count++;
  }
  console.log(`Products migrated: ${count}`);
}

async function migrateUsers(pool, db) {
  console.log('Migrating users...');
  const [rows] = await pool.execute(
    'SELECT id, email, name, role, created_at, updated_at FROM users'
  );
  let count = 0;
  for (const row of rows) {
    await db.collection('users').doc(row.id).set({
      email: row.email,
      name: row.name,
      role: row.role,
      createdAt: row.created_at ? new Date(row.created_at) : null,
      updatedAt: row.updated_at ? new Date(row.updated_at) : null,
      migratedAt: new Date()
    }, { merge: true });
    count++;
  }
  console.log(`Users migrated: ${count}`);
}

async function migrateTransactions(pool, db) {
  console.log('Migrating transactions...');
  const [rows] = await pool.execute('SELECT * FROM transactions');
  let count = 0;
  for (const row of rows) {
    let items = [];
    try {
      items = row.items ? JSON.parse(row.items) : [];
    } catch (e) {
      items = [];
    }
    await db.collection('transactions').doc(row.id).set({
      id: row.id,
      timestamp: row.timestamp || row.created_at || new Date().toISOString(),
      items,
      subtotal: Number(row.subtotal) || 0,
      tax: Number(row.tax) || 0,
      total: Number(row.total) || 0,
      paymentMethod: row.payment_method || row.paymentMethod || 'cash',
      receivedAmount: Number(row.received_amount) || 0,
      change: Number(row.change_amount || row.change) || 0,
      referenceNumber: row.reference_number || null,
      migratedAt: new Date()
    }, { merge: true });
    count++;
  }
  console.log(`Transactions migrated: ${count}`);
}

async function migrateAudits(pool, db) {
  // audits table may not exist; skip if missing
  try {
    console.log('Migrating audits...');
    const [rows] = await pool.execute('SELECT * FROM audits');
    let count = 0;
    for (const row of rows) {
      let results = [];
      try { results = row.results ? JSON.parse(row.results) : []; } catch (e) { results = []; }
      const id = row.id || row.audit_id || `AUD-${Date.now()}-${count}`;
      await db.collection('audits').doc(String(id)).set({
        id: String(id),
        date: row.audit_date || row.date || null,
        mode: row.audit_type || row.mode || null,
        productsAudited: Number(row.products_audited) || 0,
        discrepancies: Number(row.discrepancies_found) || 0,
        totalAdjustments: Number(row.total_adjustments) || 0,
        notes: row.notes || '',
        results,
        migratedAt: new Date()
      }, { merge: true });
      count++;
    }
    console.log(`Audits migrated: ${count}`);
  } catch (e) {
    console.log('Audits table not found; skipping.');
  }
}

async function main() {
  const credentials = resolveServiceAccount();
  initializeApp({ credential: credentials });
  const db = getFirestore();
  const pool = getMysqlPool();

  try {
    await migrateCategories(pool, db);
    await migrateProducts(pool, db);
    await migrateUsers(pool, db);
    await migrateTransactions(pool, db);
    await migrateAudits(pool, db);
    console.log('Migration completed successfully.');
  } catch (e) {
    console.error('Migration failed:', e);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();



