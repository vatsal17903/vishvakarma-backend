import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

// Create the connection pool
export const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true // Return dates as strings to match SQLite behavior often expect in JS
});

export async function initializeDatabase() {
  console.log('📦 Initializing MySQL database...');

  try {
    const connection = await db.getConnection();

    // Users table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Companies table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS companies (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        address TEXT,
        phone VARCHAR(50),
        email VARCHAR(255),
        gst_number VARCHAR(50),
        logo_path VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Clients table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS clients (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        address TEXT,
        phone VARCHAR(50),
        email VARCHAR(255),
        project_location TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id)
      )
    `);

    // Packages table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS packages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        bhk_type VARCHAR(50),
        tier VARCHAR(50),
        base_rate_sqft DECIMAL(10, 2),
        description TEXT,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id)
      )
    `);

    // Package items table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS package_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        package_id INT NOT NULL,
        item_name VARCHAR(255) NOT NULL,
        description TEXT,
        unit VARCHAR(50),
        sq_foot DECIMAL(10, 2),
        quantity DECIMAL(10, 2),
        rate DECIMAL(10, 2),
        amount DECIMAL(15, 2),
        room_type VARCHAR(100),
        sort_order INT DEFAULT 0,
        mm VARCHAR(255),
        status VARCHAR(50),
        FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
      )
    `);

    // Schema Migration: Add new columns to package_items if they don't exist
    try {
      await connection.execute(`ALTER TABLE package_items ADD COLUMN mm VARCHAR(255)`);
      console.log('✅ Added mm column to package_items');
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') console.log('⚠️ mm column check:', e.message);
    }

    try {
      await connection.execute(`ALTER TABLE package_items ADD COLUMN status VARCHAR(50)`);
      console.log('✅ Added status column to package_items');
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') console.log('⚠️ status column check:', e.message);
    }

    // Quotations table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS quotations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        client_id INT NOT NULL,
        quotation_number VARCHAR(100) UNIQUE NOT NULL,
        date DATE NOT NULL,
        total_sqft DECIMAL(10, 2),
        rate_per_sqft DECIMAL(10, 2),
        package_id INT,
        bedroom_count INT DEFAULT 1,
        bedroom_config TEXT,
        subtotal DECIMAL(15, 2),
        discount_type VARCHAR(20),
        discount_value DECIMAL(15, 2),
        discount_amount DECIMAL(15, 2),
        taxable_amount DECIMAL(15, 2),
        cgst_percent DECIMAL(5, 2) DEFAULT 9,
        cgst_amount DECIMAL(15, 2),
        sgst_percent DECIMAL(5, 2) DEFAULT 9,
        sgst_amount DECIMAL(15, 2),
        total_tax DECIMAL(15, 2),
        grand_total DECIMAL(15, 2),
        terms_conditions TEXT,
        payment_plan TEXT,
        notes TEXT,
        status VARCHAR(50) DEFAULT 'draft',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id),
        FOREIGN KEY (client_id) REFERENCES clients(id),
        FOREIGN KEY (package_id) REFERENCES packages(id)
      )
    `);

    // Schema Migration: Add new columns if they don't exist
    try {
      await connection.execute(`ALTER TABLE companies ADD COLUMN bank_details TEXT`);
      console.log('✅ Added bank_details column to companies');
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') console.log('⚠️ bank_details column check:', e.message);
    }

    try {
      await connection.execute(`ALTER TABLE quotations ADD COLUMN payment_plan TEXT`);
      console.log('✅ Added payment_plan column to quotations');
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') console.log('⚠️ payment_plan column check:', e.message);
    }

    // Quotation items table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS quotation_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        quotation_id INT NOT NULL,
        room_label VARCHAR(100),
        item_name VARCHAR(255) NOT NULL,
        description TEXT,
        material TEXT,
        brand VARCHAR(100),
        unit VARCHAR(50),
        quantity DECIMAL(10, 2),
        rate DECIMAL(10, 2),
        amount DECIMAL(15, 2),
        remarks TEXT,
        custom_columns TEXT,
        sort_order INT DEFAULT 0,
        FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
      )
    `);

    // Quotation column config table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS quotation_column_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        quotation_id INT NOT NULL,
        columns_config TEXT NOT NULL,
        FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
      )
    `);

    // Receipts table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS receipts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        quotation_id INT NOT NULL,
        receipt_number VARCHAR(100) UNIQUE NOT NULL,
        date DATE NOT NULL,
        amount DECIMAL(15, 2) NOT NULL,
        payment_mode VARCHAR(50) NOT NULL,
        transaction_reference VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id),
        FOREIGN KEY (quotation_id) REFERENCES quotations(id)
      )
    `);

    // Bills table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS bills (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        quotation_id INT NOT NULL,
        bill_number VARCHAR(100) UNIQUE NOT NULL,
        date DATE NOT NULL,
        subtotal DECIMAL(15, 2),
        cgst_percent DECIMAL(5, 2) DEFAULT 9,
        cgst_amount DECIMAL(15, 2),
        sgst_percent DECIMAL(5, 2) DEFAULT 9,
        sgst_amount DECIMAL(15, 2),
        total_tax DECIMAL(15, 2),
        grand_total DECIMAL(15, 2),
        paid_amount DECIMAL(15, 2) DEFAULT 0,
        balance_amount DECIMAL(15, 2),
        status VARCHAR(50) DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id),
        FOREIGN KEY (quotation_id) REFERENCES quotations(id)
      )
    `);

    // Default admin user
    const [users] = await connection.execute('SELECT * FROM users WHERE username = ?', ['admin']);
    if (users.length === 0) {
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      await connection.execute('INSERT INTO users (username, password, name) VALUES (?, ?, ?)', ['admin', hashedPassword, 'Administrator']);
      console.log('✅ Default admin user created (username: admin, password: admin123)');
    }

    // Default companies
    const [companiesCount] = await connection.execute('SELECT COUNT(*) as count FROM companies');
    if (companiesCount[0].count === 0) {
      await connection.execute(`
        INSERT INTO companies (name, code, address, phone, gst_number) 
        VALUES 
        ('Aarti Infra', 'AARTI', '123 Construction Street, City', '+91 9876543210', '27AABCU9603R1ZM'),
        ('Interior & Turnkey Firm', 'INTERIOR', '456 Design Avenue, City', '+91 9876543211', '27AABCU9603R1ZN')
      `);
      console.log('✅ Default companies created');
    }

    // Default packages (simplifying for migration check)
    const [packagesCount] = await connection.execute('SELECT COUNT(*) as count FROM packages');
    if (packagesCount[0].count === 0) {
      const tiers = ['Silver', 'Gold', 'Platinum'];
      const bhkTypes = ['1 BHK', '2 BHK', '3 BHK', '4 BHK'];
      const baseRates = { Silver: 1200, Gold: 1500, Platinum: 2000 };

      // We need company IDs.
      const [companies] = await connection.execute('SELECT * FROM companies');
      const aarti = companies.find(c => c.code === 'AARTI');
      const interior = companies.find(c => c.code === 'INTERIOR');

      if (aarti) {
        for (const tier of tiers) {
          for (const bhk of bhkTypes) {
            await connection.execute(
              'INSERT INTO packages (company_id, name, bhk_type, tier, base_rate_sqft, description, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)',
              [aarti.id, `${bhk} ${tier} Package`, bhk, tier, baseRates[tier], `Complete ${bhk} construction package with ${tier.toLowerCase()} finishes`]
            );
          }
        }
      }

      if (interior) {
        for (const tier of tiers) {
          for (const bhk of bhkTypes) {
            await connection.execute(
              'INSERT INTO packages (company_id, name, bhk_type, tier, base_rate_sqft, description, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)',
              [interior.id, `${bhk} ${tier} Interior`, bhk, tier, baseRates[tier] * 0.8, `Complete ${bhk} interior package with ${tier.toLowerCase()} finishes`]
            );
          }
        }
      }
      console.log('✅ Default packages created');
    }

    connection.release();
    console.log('✅ MySQL Database initialized successfully');
  } catch (error) {
    if (error.code === 'ER_ACCESS_DENIED_ERROR' || error.code === 'ER_DBACCESS_DENIED_ERROR') {
      console.error('\n❌ DATABASE ACCESS DENIED');
      console.error('Please run the following SQL setup script in your MySQL client (Workbench/Command Line):');
      console.error('File: setup_db.sql');
      console.error('----------------------------------------');
      console.error(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME};`);
      console.error(`CREATE USER IF NOT EXISTS '${process.env.DB_USER}'@'${process.env.DB_HOST}' IDENTIFIED BY '${process.env.DB_PASSWORD}';`);
      console.error(`GRANT ALL PRIVILEGES ON ${process.env.DB_NAME}.* TO '${process.env.DB_USER}'@'${process.env.DB_HOST}';`);
      console.error('FLUSH PRIVILEGES;');
      console.error('----------------------------------------\n');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('\n❌ DATABASE CONNECTION REFUSED');
      console.error('Please ensure your MySQL server is running on localhost:3306');
    }
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  }
}
