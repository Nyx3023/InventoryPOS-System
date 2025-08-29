-- Active: 1748449162138@@127.0.0.1@3306@test
-- Create database
CREATE DATABASE IF NOT EXISTS pos_inventory;
USE pos_inventory;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role ENUM('admin', 'staff') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    name VARCHAR(255) PRIMARY KEY,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_name VARCHAR(255),
    price DECIMAL(10, 2) NOT NULL,
    cost_price DECIMAL(10, 2) NOT NULL,
    quantity INT NOT NULL DEFAULT 0,
    low_stock_threshold INT NOT NULL DEFAULT 10,
    barcode VARCHAR(255) UNIQUE,
    image_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_name) REFERENCES categories(name) ON DELETE SET NULL
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36),
    total_amount DECIMAL(10, 2) NOT NULL,
    payment_method ENUM('cash', 'card', 'other') NOT NULL,
    status ENUM('completed', 'refunded', 'cancelled') NOT NULL DEFAULT 'completed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Transaction items table
CREATE TABLE IF NOT EXISTS transaction_items (
    id VARCHAR(36) PRIMARY KEY,
    transaction_id VARCHAR(36) NOT NULL,
    product_id VARCHAR(36) NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
);

-- Inventory movements table
CREATE TABLE IF NOT EXISTS inventory_movements (
    id VARCHAR(36) PRIMARY KEY,
    product_id VARCHAR(36) NOT NULL,
    type ENUM('in', 'out', 'adjustment') NOT NULL,
    quantity INT NOT NULL,
    reason TEXT,
    user_id VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes
CREATE INDEX idx_products_category ON products(category_name);
CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transaction_items_transaction ON transaction_items(transaction_id);
CREATE INDEX idx_transaction_items_product ON transaction_items(product_id);
CREATE INDEX idx_inventory_movements_product ON inventory_movements(product_id);
CREATE INDEX idx_inventory_movements_user ON inventory_movements(user_id);

-- Insert default categories
INSERT INTO categories (name, description) VALUES
('Foods', 'Food items and beverages'),
('Electronics', 'Electronic devices and accessories'),
('Clothing', 'Apparel and fashion items'),
('Household', 'Household items and supplies'),
('Others', 'Miscellaneous items'); 