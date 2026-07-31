import mongoose from "mongoose";
import dotenv from "dotenv";

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

    await mongoose.connect(mongoURI, MONGOOSE_OPTIONS);

    console.log("✅ MongoDB Connected Successfully");
    return mongoose.connection;
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error.message);
    console.error("Stack:", error.stack);
    process.exit(1);
  }
};

export default connectDB;
