import mongoose from "mongoose";
import env from "./env.js";

async function connectDB() {
  try {
    await mongoose.connect(env.mongoUri);
    console.log(`MongoDB connected successfully (${env.nodeEnv} environment)`);
  } catch (error) {
    console.error(
      "MongoDB connection failed. Please check your database configuration.",
    );
    throw new Error("Failed to connect to the database.");
  }
}

export default connectDB;
