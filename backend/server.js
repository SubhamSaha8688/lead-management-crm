require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const leadsRoutes = require("./routes/leads");
const coursesRoutes = require("./routes/courses");
const whatsappTemplatesRoutes = require("./routes/whatsappTemplates");
const emailTemplatesRoutes = require("./routes/emailTemplates");
const authRoutes = require("./routes/auth");
const { authMiddleware } = require("./middleware/auth");

const app = express();
const PORT = process.env.PORT || 5000;

// Configure CORS (Strict whitelist, removing wildcard .vercel.app)
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "https://lead-management-crm-theta.vercel.app",
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like curl, mobile apps, server-to-server)
      if (!origin) return callback(null, true);
      // Allow exact matched origins or local dev
      if (
        allowedOrigins.indexOf(origin) !== -1 ||
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

// Attach Mongoose lifecycle event listeners
mongoose.connection.on("connected", () => {
  isConnected = true;
  console.log("[MongoDB] Atlas connected successfully.");
});
mongoose.connection.on("error", (err) => {
  isConnected = false;
  console.error("[MongoDB] Connection error:", err.message);
});
mongoose.connection.on("disconnected", () => {
  isConnected = false;
  console.warn("[MongoDB] Disconnected from Atlas. Auto-reconnect will trigger on incoming request.");
});

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
  } catch (err) {
    isConnected = false;
    console.error("MongoDB Atlas connection error:", err.message);
  }
};

// Middleware to ensure DB connection before handling requests
app.use(async (req, res, next) => {
  // Allow health endpoint and root status to respond even if DB is reconnecting
  if (req.path === "/api/health" || req.path === "/") {
    return next();
  }

  if (!isConnected || mongoose.connection.readyState !== 1) {
    await connectDB();
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      message: "Database service temporarily unavailable. Please retry in a few moments."
    });
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

// Public Routes
app.use("/api/auth", authRoutes);

// Protected Routes (Require valid counselor session token)
app.use("/api/leads", authMiddleware, leadsRoutes);
app.use("/api/courses", authMiddleware, coursesRoutes);
app.use("/api/whatsapp-templates", authMiddleware, whatsappTemplatesRoutes);
app.use("/api/email-templates", authMiddleware, emailTemplatesRoutes);

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
