import { PrismaClient } from "../src/generated/prisma/index.js";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function check() {
    try {
        const users = await prisma.user.findMany({
            select: {
                email: true,
                role: true,
                passwordHash: true,
                isActive: true,
            },
        });

        console.log("Users in database:");
        for (const user of users) {
            console.log(`\n- Email: ${user.email}`);
            console.log(`  Role: ${user.role}`);
            console.log(`  Active: ${user.isActive}`);
            console.log(`  Has password: ${user.passwordHash ? "Yes" : "No"}`);
            
            if (user.passwordHash) {
                const isValid = await bcrypt.compare("123456", user.passwordHash);
                console.log(`  Password "123456" valid: ${isValid}`);
            }
        }
    } catch (error) {
        console.error("Error:", error);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

check();
