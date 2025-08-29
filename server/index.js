import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import pool from './db.js';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from uploads directory
app.use('/uploads', express.static('uploads'));

// Ensure Outbox table exists and helper to enqueue operations
async function ensureOutboxTable() {
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS outbox (
        id VARCHAR(36) PRIMARY KEY,
        entity_type VARCHAR(32) NOT NULL,
        entity_id VARCHAR(64) NOT NULL,
        op_type VARCHAR(16) NOT NULL,
        payload JSON NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'pending',
        attempt_count INT NOT NULL DEFAULT 0,
        last_error TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status_created_at (status, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('Outbox table is ready');
  } catch (e) {
    console.error('Failed to ensure outbox table:', e);
  }
}

async function enqueueOutbox(entityType, entityId, opType, payloadObj) {
  try {
    const outboxId = uuidv4();
    await pool.execute(
      `INSERT INTO outbox (id, entity_type, entity_id, op_type, payload, status) VALUES (?, ?, ?, ?, CAST(? AS JSON), 'pending')`,
      [outboxId, entityType, entityId, opType, JSON.stringify(payloadObj || null)]
    );
    return outboxId;
  } catch (e) {
    console.error('Failed to enqueue outbox entry:', { entityType, entityId, opType }, e);
  }
}

ensureOutboxTable();
// Ensure categories table exists
async function ensureCategoriesTable() {
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description VARCHAR(255) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('Categories table is ready');
  } catch (e) {
    console.error('Failed to ensure categories table:', e);
  }
}

ensureCategoriesTable();

// Ensure transactions table has reference_number column
async function ensureTransactionsSchema() {
  try {
    // Add reference_number column if missing
    await pool.execute(`
      ALTER TABLE transactions
      ADD COLUMN IF NOT EXISTS reference_number VARCHAR(128) NULL
    `);
    console.log('Transactions schema verified');
  } catch (e) {
    // Some MySQL versions do not support IF NOT EXISTS on ADD COLUMN; fall back to check-then-add
    try {
      const [cols] = await pool.execute(`SHOW COLUMNS FROM transactions LIKE 'reference_number'`);
      if (!cols || cols.length === 0) {
        await pool.execute(`ALTER TABLE transactions ADD COLUMN reference_number VARCHAR(128) NULL`);
        console.log('Added reference_number to transactions');
      }
    } catch (err) {
      console.error('Failed to ensure transactions schema:', err);
    }
  }
}

ensureTransactionsSchema();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/products/';
    try {
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
        console.log('Created uploads directory:', uploadPath);
      }
      cb(null, uploadPath);
    } catch (error) {
      console.error('Error creating upload directory:', error);
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = uniqueSuffix + path.extname(file.originalname);
    console.log('Generated filename:', filename);
    cb(null, filename);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extName = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimeType = allowedTypes.test(file.mimetype);
    
    if (mimeType && extName) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Test database connection
pool.getConnection()
  .then(connection => {
    console.log('Connected to MySQL database');
    connection.release();
  })
  .catch(err => {
    console.error('Error connecting to the database:', err);
  });

// Authentication routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt for:', email);

    // Get user from database
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    const user = users[0];

    if (!user) {
      console.log('User not found:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Compare password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      console.log('Invalid password for user:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Remove password hash before sending user data
    const { password_hash, ...userWithoutPassword } = user;

    console.log('Login successful for:', email);
    res.json({
      success: true,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during login'
    });
  }
});

// Image upload endpoint
app.post('/api/upload-image', (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.error('Multer error:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ 
          error: 'File too large. Maximum size is 5MB.',
          code: 'FILE_TOO_LARGE'
        });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ 
          error: 'Unexpected field name. Use "image" as the field name.',
          code: 'UNEXPECTED_FIELD'
        });
      }
      return res.status(400).json({ 
        error: `Upload error: ${err.message}`,
        code: err.code
      });
    } else if (err) {
      console.error('Upload error:', err);
      return res.status(400).json({ 
        error: err.message,
        code: 'INVALID_FILE_TYPE'
      });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ 
          error: 'No image file uploaded',
          code: 'NO_FILE'
        });
      }
      
      const imageUrl = `/uploads/products/${req.file.filename}`;
      console.log('Image uploaded successfully:', imageUrl);
      
      res.json({
        success: true,
        imageUrl: imageUrl,
        filename: req.file.filename
      });
    } catch (error) {
      console.error('Error processing uploaded image:', error);
      res.status(500).json({ 
        error: 'Failed to process uploaded image',
        code: 'PROCESSING_ERROR'
      });
    }
  });
});

// Delete image endpoint
app.delete('/api/delete-image', async (req, res) => {
  try {
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({ 
        error: 'Image URL is required',
        code: 'NO_IMAGE_URL'
      });
    }

    // Only delete local uploaded images (not external URLs)
    if (imageUrl.startsWith('/uploads/')) {
      const imagePath = imageUrl.replace('/uploads/', 'uploads/');
      
      try {
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
          console.log('Deleted image file:', imagePath);
          res.json({ 
            success: true, 
            message: 'Image deleted successfully',
            deletedPath: imagePath
          });
        } else {
          console.log('Image file not found:', imagePath);
          res.json({ 
            success: true, 
            message: 'Image file not found (may have been already deleted)',
            deletedPath: imagePath
          });
        }
      } catch (fileError) {
        console.error('Failed to delete image file:', imagePath, fileError);
        res.status(500).json({ 
          error: 'Failed to delete image file',
          code: 'FILE_DELETE_ERROR',
          details: fileError.message
        });
      }
    } else {
      // External URL - just return success (nothing to delete server-side)
      console.log('External image URL, nothing to delete:', imageUrl);
      res.json({ 
        success: true, 
        message: 'External image URL, no server-side deletion needed',
        imageUrl: imageUrl
      });
    }
  } catch (error) {
    console.error('Error in delete image endpoint:', error);
    res.status(500).json({ 
      error: 'Failed to delete image',
      code: 'DELETE_ERROR',
      details: error.message
    });
  }
});

// Get all products
app.get('/api/products', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, description, category_name, price, cost_price as costPrice, ' +
      'quantity, low_stock_threshold as lowStockThreshold, barcode, image_url as imageUrl ' +
      'FROM products'
    );
    console.log('Products fetched:', rows);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Create a product
app.post('/api/products', async (req, res) => {
  try {
    const id = uuidv4();
    const product = req.body;
    console.log('Creating product:', product);
    
    await pool.execute(
      `INSERT INTO products (
        id, name, description, category_name, 
        price, cost_price, quantity, low_stock_threshold, 
        barcode, image_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        product.name,
        product.description,
        product.category,
        product.price,
        product.costPrice,
        product.quantity,
        product.lowStockThreshold,
        product.barcode,
        product.imageUrl
      ]
    );
    
    console.log('Product created with ID:', id);
    // Enqueue outbox for sync
    enqueueOutbox('product', id, 'create', { id, ...product });

    res.status(201).json({ id, ...product });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product', details: error.message });
  }
});

// Update a product
app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const product = req.body;
    console.log('Updating product:', id, product);
    
    // Map frontend field names to database field names and handle undefined values
    const updateData = {
      name: product.name || null,
      description: product.description || null,
      category_name: product.category_name || product.category || null,
      price: product.price || 0,
      cost_price: product.costPrice || product.cost_price || 0,
      quantity: product.quantity || 0,
      low_stock_threshold: product.lowStockThreshold || product.low_stock_threshold || 10,
      barcode: product.barcode || null,
      image_url: product.imageUrl || product.image_url || null
    };
    
    console.log('Mapped update data:', updateData);
    
    const [result] = await pool.execute(
      `UPDATE products SET 
        name = ?,
        description = ?,
        category_name = ?,
        price = ?,
        cost_price = ?,
        quantity = ?,
        low_stock_threshold = ?,
        barcode = ?,
        image_url = ?
      WHERE id = ?`,
      [
        updateData.name,
        updateData.description,
        updateData.category_name,
        updateData.price,
        updateData.cost_price,
        updateData.quantity,
        updateData.low_stock_threshold,
        updateData.barcode,
        updateData.image_url,
        id
      ]
    );
    
    if (result.affectedRows === 0) {
      console.log('Product not found:', id);
      res.status(404).json({ error: 'Product not found' });
    } else {
      console.log('Product updated successfully:', id);
      // Enqueue outbox for sync
      enqueueOutbox('product', id, 'update', { id, ...updateData });
      res.json({ id, ...updateData });
    }
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product', details: error.message });
  }
});

// Get a single product by ID
app.get('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Fetching product:', id);
    
    const [rows] = await pool.execute(
      'SELECT id, name, description, category_name, price, cost_price as costPrice, ' +
      'quantity, low_stock_threshold as lowStockThreshold, barcode, image_url as imageUrl ' +
      'FROM products WHERE id = ?',
      [id]
    );
    
    if (rows.length === 0) {
      console.log('Product not found:', id);
      res.status(404).json({ error: 'Product not found' });
    } else {
      console.log('Product fetched:', rows[0]);
      res.json(rows[0]);
    }
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product', details: error.message });
  }
});

// Delete a product
app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Deleting product:', id);
    
    // First, get the product to retrieve the image URL
    const [productRows] = await pool.execute(
      'SELECT image_url FROM products WHERE id = ?',
      [id]
    );
    
    if (productRows.length === 0) {
      console.log('Product not found:', id);
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const product = productRows[0];
    
    // Delete the product from database
    const [result] = await pool.execute('DELETE FROM products WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      console.log('Product not found:', id);
      res.status(404).json({ error: 'Product not found' });
    } else {
      // Enqueue outbox for sync (delete)
      enqueueOutbox('product', id, 'delete', { id });
      // Clean up the image file if it exists and is a local file
      if (product.image_url && product.image_url.startsWith('/uploads/')) {
        const imagePath = product.image_url.replace('/uploads/', 'uploads/');
        try {
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
            console.log('Deleted image file:', imagePath);
          }
        } catch (fileError) {
          console.warn('Failed to delete image file:', imagePath, fileError);
          // Don't fail the entire operation if file deletion fails
        }
      }
      
      console.log('Product deleted:', id);
      res.json({ success: true });
    }
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product', details: error.message });
  }
});

// Get categories
app.get('/api/categories', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT name, description FROM categories');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Create category (admin client should control access)
app.post('/api/categories', async (req, res) => {
  try {
    const { name, description } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    await pool.execute(
      'INSERT INTO categories (name, description) VALUES (?, ?)',
      [name.trim(), description || null]
    );
    console.log('Category created:', name);
    res.status(201).json({ name: name.trim(), description: description || null });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category', details: error.message });
  }
});

// Delete category by name (admin only)
app.delete('/api/categories/:name', async (req, res) => {
  try {
    const { name } = req.params;
    if (!name) return res.status(400).json({ error: 'Category name is required' });
    const [result] = await pool.execute('DELETE FROM categories WHERE name = ?', [name]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    console.log('Category deleted:', name);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category', details: error.message });
  }
});

// User Management Routes

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, email, name, role, created_at, updated_at FROM users ORDER BY created_at DESC'
    );
    console.log('Users fetched:', rows);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create a new user
app.post('/api/users', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    console.log('Creating user:', { name, email, role });

    // Validate required fields
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user already exists
    const [existingUsers] = await pool.execute(
      'SELECT email FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Generate UUID for ID since table uses VARCHAR(36)
    const userId = uuidv4();

    // Hash the password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);
    
    const [result] = await pool.execute(
      'INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [userId, name, email, password_hash, role]
    );
    
    console.log('User created with ID:', userId);
    
    // Return user without password
    res.status(201).json({ 
      id: userId, 
      name, 
      email, 
      role,
      created_at: new Date()
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user', details: error.message });
  }
});

// Update a user
app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, role } = req.body;
    console.log('Updating user:', id, { name, email, role });

    // Check if user exists
    const [existingUsers] = await pool.execute(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );

    if (existingUsers.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if email is already taken by another user
    const [emailCheck] = await pool.execute(
      'SELECT id FROM users WHERE email = ? AND id != ?',
      [email, id]
    );

    if (emailCheck.length > 0) {
      return res.status(400).json({ error: 'Email is already taken by another user' });
    }

    let updateQuery = 'UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?';
    let updateParams = [name, email, role, id];

    // If password is provided, update it too
    if (password && password.trim() !== '') {
      const saltRounds = 10;
      const password_hash = await bcrypt.hash(password, saltRounds);
      updateQuery = 'UPDATE users SET name = ?, email = ?, password_hash = ?, role = ? WHERE id = ?';
      updateParams = [name, email, password_hash, role, id];
    }
    
    const [result] = await pool.execute(updateQuery, updateParams);
    
    if (result.affectedRows === 0) {
      console.log('User not found:', id);
      res.status(404).json({ error: 'User not found' });
    } else {
      console.log('User updated:', id);
      res.json({ 
        id: id,
        name, 
        email, 
        role,
        updated_at: new Date()
      });
    }
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user', details: error.message });
  }
});

// Delete a user
app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Deleting user:', id);

    // Check if user exists
    const [existingUsers] = await pool.execute(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );

    if (existingUsers.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deleting the last admin user
    if (existingUsers[0].role === 'admin') {
      const [adminCount] = await pool.execute(
        'SELECT COUNT(*) as count FROM users WHERE role = "admin"'
      );
      
      if (adminCount[0].count <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last admin user' });
      }
    }
    
    const [result] = await pool.execute('DELETE FROM users WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      console.log('User not found:', id);
      res.status(404).json({ error: 'User not found' });
    } else {
      console.log('User deleted:', id);
      res.json({ success: true });
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user', details: error.message });
  }
});

// Transaction Management Routes

// Get all transactions
app.get('/api/transactions', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = 'SELECT * FROM transactions ORDER BY timestamp DESC';
    let params = [];
    
    if (startDate && endDate) {
      query = 'SELECT * FROM transactions WHERE timestamp BETWEEN ? AND ? ORDER BY timestamp DESC';
      params = [startDate, endDate];
    }
    
    const [rows] = await pool.execute(query, params);
    
    // Parse items JSON for each transaction
    const transactions = rows.map(transaction => ({
      ...transaction,
      items: transaction.items ? JSON.parse(transaction.items) : []
    }));
    
    console.log('Transactions fetched:', transactions.length);
    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Get a single transaction by ID
app.get('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Fetching transaction:', id);
    
    const [rows] = await pool.execute('SELECT * FROM transactions WHERE id = ?', [id]);
    
    if (rows.length === 0) {
      console.log('Transaction not found:', id);
      res.status(404).json({ error: 'Transaction not found' });
    } else {
      const transaction = {
        ...rows[0],
        items: rows[0].items ? JSON.parse(rows[0].items) : []
      };
      console.log('Transaction fetched:', transaction);
      res.json(transaction);
    }
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({ error: 'Failed to fetch transaction', details: error.message });
  }
});

// Create a transaction
app.post('/api/transactions', async (req, res) => {
  try {
    const transaction = req.body;
    console.log('Creating transaction:', transaction);
    
    await pool.execute(
      `INSERT INTO transactions (
        id, timestamp, items, subtotal, tax, total,
        payment_method, received_amount, change_amount, reference_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        transaction.id,
        transaction.timestamp,
        JSON.stringify(transaction.items),
        transaction.subtotal,
        transaction.tax,
        transaction.total,
        transaction.paymentMethod,
        transaction.receivedAmount,
        transaction.change,
        transaction.referenceNumber || null
      ]
    );
    
    console.log('Transaction created with ID:', transaction.id);
    // Enqueue outbox for sync
    enqueueOutbox('transaction', transaction.id, 'create', transaction);
    res.status(201).json(transaction);
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: 'Failed to create transaction', details: error.message });
  }
});

// Delete a transaction (admin only)
app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userRole } = req.body; // We'll send user role from frontend
    
    console.log('Delete transaction request:', id, 'by role:', userRole);
    
    // Check if user is admin
    if (userRole !== 'admin') {
      console.log('Unauthorized transaction deletion attempt by role:', userRole);
      return res.status(403).json({ 
        error: 'Access denied. Only administrators can delete transactions.',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }
    
    // Check if transaction exists
    const [transactionRows] = await pool.execute(
      'SELECT id FROM transactions WHERE id = ?',
      [id]
    );
    
    if (transactionRows.length === 0) {
      console.log('Transaction not found:', id);
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    // Delete the transaction
    const [result] = await pool.execute('DELETE FROM transactions WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      console.log('Transaction deletion failed:', id);
      res.status(404).json({ error: 'Transaction not found' });
    } else {
      // Enqueue outbox for sync (delete)
      enqueueOutbox('transaction', id, 'delete', { id });
      console.log('Transaction deleted successfully:', id);
      res.json({ 
        success: true, 
        message: 'Transaction deleted successfully',
        deletedId: id 
      });
    }
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ error: 'Failed to delete transaction', details: error.message });
  }
});

// Outbox Sync Endpoints
app.get('/api/outbox', async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const [rows] = await pool.execute(
      'SELECT * FROM outbox WHERE status = ? ORDER BY created_at ASC LIMIT ?',
      [status, limit]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching outbox entries:', error);
    res.status(500).json({ error: 'Failed to fetch outbox entries' });
  }
});

app.put('/api/outbox/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, error: lastError } = req.body || {};
    if (!status || !['pending', 'synced', 'failed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const [result] = await pool.execute(
      `UPDATE outbox SET status = ?, attempt_count = attempt_count + 1, last_error = ? WHERE id = ?`,
      [status, lastError || null, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Outbox entry not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating outbox entry:', error);
    res.status(500).json({ error: 'Failed to update outbox entry' });
  }
});

// Audit Management Routes

// Get all audits
app.get('/api/audits', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM audits ORDER BY audit_date DESC'
    );
    
    // Parse results JSON for each audit
    const audits = rows.map(audit => ({
      ...audit,
      results: audit.results ? JSON.parse(audit.results) : []
    }));
    
    console.log('Audits fetched:', audits.length);
    res.json(audits);
  } catch (error) {
    console.error('Error fetching audits:', error);
    res.status(500).json({ error: 'Failed to fetch audits' });
  }
});

// Create an audit
app.post('/api/audits', async (req, res) => {
  try {
    const audit = req.body;
    console.log('Creating audit:', audit);
    
    const auditId = audit.auditId || uuidv4();
    
    await pool.execute(
      `INSERT INTO audits (
        id, audit_date, audit_type, products_audited, 
        discrepancies_found, total_adjustments, notes, results
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        auditId,
        audit.date,
        audit.mode,
        audit.productsAudited,
        audit.discrepancies,
        audit.totalAdjustments,
        audit.notes,
        JSON.stringify(audit.results)
      ]
    );
    
    console.log('Audit created with ID:', auditId);
    res.status(201).json({ ...audit, id: auditId });
  } catch (error) {
    console.error('Error creating audit:', error);
    res.status(500).json({ error: 'Failed to create audit', details: error.message });
  }
});

// Analytics Routes

// Get low stock products
app.get('/api/analytics/low-stock', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, category_name as category, quantity, low_stock_threshold as lowStockThreshold ' +
      'FROM products WHERE quantity <= low_stock_threshold ORDER BY quantity ASC'
    );
    
    console.log('Low stock products fetched:', rows.length);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching low stock products:', error);
    res.status(500).json({ error: 'Failed to fetch low stock products' });
  }
});

// Get sales analytics
app.get('/api/analytics/sales', async (req, res) => {
  try {
    const { period = 'monthly' } = req.query;
    
    // Calculate date range based on period
    const now = new Date();
    let startDate;
    
    switch (period) {
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'quarterly':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'yearly':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default: // monthly
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    
    const [transactions] = await pool.execute(
      'SELECT * FROM transactions WHERE timestamp >= ? ORDER BY timestamp DESC',
      [startDate.toISOString()]
    );
    
    // Parse items for each transaction
    const parsedTransactions = transactions.map(transaction => ({
      ...transaction,
      items: transaction.items ? JSON.parse(transaction.items) : []
    }));
    
    console.log('Sales analytics fetched for period:', period, 'transactions:', parsedTransactions.length);
    res.json(parsedTransactions);
  } catch (error) {
    console.error('Error fetching sales analytics:', error);
    res.status(500).json({ error: 'Failed to fetch sales analytics' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app; 