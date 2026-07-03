import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pool from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read and execute migration file
const initDatabase = async () => {
  try {
    const migrationPath = path.join(
      __dirname,
      "migrations"
    );

    const migrationFiles = fs.readdirSync(migrationPath)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationPath, file), 'utf8');
      await pool.query(sql);
      console.log(`Ran migration: ${file}`);
    }

    console.log("Database tables initialized successfully");
  } catch (error) {
    console.error("Error initializing database:", error);
    throw error;
  }
};

export default initDatabase;
