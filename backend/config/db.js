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
  tls: true,
  tlsAllowInvalidCertificates: false,
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  heartbeatFrequencyMS: 10000,
  retryWrites: true,
  w: "majority",
};

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI;

    if (!mongoURI) {
      throw new Error("MONGO_URI is not defined in .env file");
    }

    mongoose.connection.on("error", (err) => {
      console.error("❌ MongoDB runtime connection error:", err.message);
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("⚠️ MongoDB disconnected. Attempting to reconnect...");
    });

    mongoose.connection.on("reconnected", () => {
      console.log("✅ MongoDB reconnected");
    });

    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log("✅ MongoDB Connected Successfully");
    return mongoose.connection;
  } catch (error) {
    console.warn("⚠️ MongoDB Connection Warning:", error.message);
    console.warn("Backend server running in standalone mode...");
  }
};

export default connectDB;
