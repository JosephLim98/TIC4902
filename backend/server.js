import "dotenv/config";
import cors from "cors";
import express from "express";
import { initializeDatabase } from "./src/config/database.js";
import initDatabase from "./src/db/init.js";
import { mountSwagger } from "./src/docs/serveSwagger.js";
import errorHandler from "./src/middleware/errorHandler.js";
import routes from "./src/routes/index.js";
import { ensureBucketExists, ensureLogBucketExists } from "./src/service/minioService.js";

const app = express();
const PORT = process.env.PORT || 3000;

// app.use(cors());
app.use(cors({
  exposedHeaders: ['Retry-After', 'RateLimit-Policy', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
}));

app.use(express.json());

// Routes
app.use("/api", routes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Server is running" });
});

mountSwagger(app);

app.use(errorHandler);

// Initialize database and start server
const startServer = async () => {
  try {
    await Promise.all([
      initDatabase(),
      initializeDatabase(),
      ensureBucketExists().catch(err =>
        console.error("MinIO bucket setup failed, JAR upload will be unavailable:", err.message)
      ),
      ensureLogBucketExists().catch(err =>
        console.error("MinIO log bucket setup failed: ", err.message)
      ),
    ]);
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
