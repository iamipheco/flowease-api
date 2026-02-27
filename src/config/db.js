import mongoose from "mongoose";

const connectDB = async () => {
  const { MONGO_URI } = process.env;

  if (!MONGO_URI) {
    throw new Error("MONGO_URI is not defined");
  }

  const conn = await mongoose.connect(MONGO_URI, {
    autoIndex: false,
    serverSelectionTimeoutMS: 5000,
    maxPoolSize: 10,
  });

  console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
};

export const setupDBListeners = () => {
  mongoose.connection.on("error", (err) => {
    console.error("❌ MongoDB connection error:", err);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("⚠️ MongoDB disconnected");
  });

  const gracefulShutdown = async (signal) => {
    await mongoose.connection.close();
    console.log(`MongoDB connection closed via ${signal}`);
    process.exit(0);
  };

  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("unhandledRejection", (err) => {
    console.error("❌ Unhandled Rejection:", err);
    process.exit(1);
  });
};

export default connectDB;