import mongoose from "mongoose";
import dotenv from "dotenv";
import dns from "dns";

try {
  dns.setDefaultResultOrder("ipv4first");
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {
  // Ignore DNS config errors if unsupported
}

dotenv.config();

const MONGOOSE_OPTIONS = {
  maxPoolSize: 100,
  minPoolSize: 10,
  maxIdleTimeMS: 30000,
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  heartbeatFrequencyMS: 10000,
  retryWrites: true,
  w: "majority",
  autoIndex: process.env.NODE_ENV !== "production",
};

let isConnected = false;

const connectDB = async () => {
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  try {
    const mongoURI = process.env.MONGO_URI;

    if (!mongoURI) {
      throw new Error("MONGO_URI is not defined in .env file");
    }

    mongoose.connection.on("error", (err) => {
      console.error("❌ MongoDB runtime connection error:", err.message);
    });

    mongoose.connection.on("disconnected", () => {
      isConnected = false;
      console.warn("⚠️ MongoDB disconnected. Attempting to reconnect...");
    });

    mongoose.connection.on("reconnected", () => {
      isConnected = true;
      console.log("✅ MongoDB reconnected");
    });

    await mongoose.connect(mongoURI, MONGOOSE_OPTIONS);
    isConnected = true;

    console.log("✅ MongoDB Connected Successfully with connection pool (maxPoolSize: 100, minPoolSize: 10)");
    return mongoose.connection;
  } catch (error) {
    isConnected = false;
    console.warn("⚠️ MongoDB Connection Warning:", error.message);
    console.warn("Backend server running in standalone mode...");
  }
};

export default connectDB;
