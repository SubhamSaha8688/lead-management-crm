require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const leadsRoutes = require("./routes/leads");
const coursesRoutes = require("./routes/courses");

const app = express();
const PORT = process.env.PORT || 5000;

// Configure CORS
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      // In development or if origin matches allowed origins or matches vercel.app
      if (
        allowedOrigins.indexOf(origin) !== -1 ||
        origin.endsWith(".vercel.app") ||
        process.env.NODE_ENV !== "production"
      ) {
        return callback(null, true);
      }
      return callback(new Error("CORS policy: Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// MongoDB Connection with connection caching for serverless
let isConnected = false;

const connectDB = async () => {
  if (isConnected && mongoose.connection.readyState === 1) {
    return;
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("CRITICAL ERROR: MONGODB_URI environment variable is not defined.");
    return;
  }

  try {
    const db = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000
    });
    isConnected = db.connections[0].readyState === 1;
    console.log("MongoDB Atlas connected successfully.");
  } catch (err) {
    console.error("MongoDB Atlas connection error:", err.message);
  }
};

// Middleware to ensure DB connection before handling requests
app.use(async (req, res, next) => {
  if (!isConnected || mongoose.connection.readyState !== 1) {
    await connectDB();
  }
  next();
});

// Root endpoint
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Lead Management CRM API is online. Access the frontend CRM dashboard at http://localhost:5173",
    health: "/api/health",
    endpoints: {
      leads: "/api/leads",
      courses: "/api/courses"
    }
  });
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Lead Management CRM Backend is running.",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use("/api/leads", leadsRoutes);
app.use("/api/courses", coursesRoutes);

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found.`
  });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error("Server Error:", err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error"
  });
});

// Start local server if not running inside Vercel serverless environment
if (!process.env.VERCEL) {
  connectDB().then(() => {
    app.listen(PORT, () => {
      console.log(`Backend server running locally on http://localhost:${PORT}`);
    });
  });
}

// Export for Vercel serverless functions
module.exports = app;
