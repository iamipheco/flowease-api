// src/config/db.js
import mongoose from "mongoose";

const connectDB = async () => {
  const { MONGO_URI } = process.env;

  if (!MONGO_URI) {
    throw new Error("MONGO_URI is not defined");
  }

  try {
    const conn = await mongoose.connect(MONGO_URI, {
      autoIndex: false,
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1); // exit if cannot connect
  }
};

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  try {
    await mongoose.connection.close();
    console.log(`MongoDB connection closed via ${signal}`);
  } catch (err) {
    console.error("Error closing MongoDB connection:", err);
  } finally {
    process.exit(0);
  }
};

// Set up listeners for production
export const setupDBListeners = () => {
  mongoose.connection.on("connected", () => {
    console.log("MongoDB connected");
  });

  mongoose.connection.on("error", (err) => {
    console.error("❌ MongoDB connection error:", err);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("⚠️ MongoDB disconnected");
  });

  // Listen to termination signals
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));   // Ctrl+C
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM")); // Heroku / Docker

  // Catch unhandled promise rejections
  process.on("unhandledRejection", async (err) => {
    console.error("❌ Unhandled Rejection:", err);
    await gracefulShutdown("UNHANDLED_REJECTION");
  });

  // Catch uncaught exceptions
  process.on("uncaughtException", async (err) => {
    console.error("❌ Uncaught Exception:", err);
    await gracefulShutdown("UNCAUGHT_EXCEPTION");
  });
};

export default connectDB;