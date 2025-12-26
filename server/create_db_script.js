import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars from the root .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function createDb() {
    console.log('🔌 Connecting to MySQL server...');
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD,
        });

        const dbName = process.env.DB_NAME || 'Vishvakarma';
        console.log(`🛠️  Creating database '${dbName}' if it does not exist...`);

        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
        console.log(`✅ Database '${dbName}' is ready.`);

        await connection.end();
    } catch (error) {
        console.error('❌ Error creating database:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.error('   Please verify that your MySQL server is running on localhost:3306');
        }
    }
}

createDb();
