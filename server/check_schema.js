
import { db } from './database/init.js';

async function check() {
    try {
        const [rows] = await db.execute('DESCRIBE quotations');
        console.log('Quotations Table Schema:');
        rows.forEach(row => {
            if (row.Field === 'package_id') {
                console.log(row);
            }
        });
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
