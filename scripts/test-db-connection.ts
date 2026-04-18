import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL;
console.log("Testing database connection...");
console.log("Connection string:", connectionString?.replace(/:[^:@]+@/, ':****@'));

const pool = new Pool({ connectionString });

async function test() {
    try {
        const result = await pool.query("SELECT 1 as test");
        console.log("✓ Database connection successful!");
        console.log("Result:", result.rows);
    } catch (error) {
        console.error("✗ Database connection failed:");
        console.error(error);
    } finally {
        await pool.end();
    }
}

test();
