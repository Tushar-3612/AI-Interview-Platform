// backend/config/db.js

import mongoose from "mongoose";
import dotenv from "dotenv";
import dns from "dns";

// Force Node.js to use Google DNS to resolve MongoDB Atlas SRV records
dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

dotenv.config();

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI;

    if (!mongoURI) {
      throw new Error("MONGO_URI is not defined in .env file");
    }

    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 30000,
      family: 4, // Force IPv4
    });

    console.log("✅ MongoDB Connected Successfully");
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error.message);
  }
};

export default connectDB;