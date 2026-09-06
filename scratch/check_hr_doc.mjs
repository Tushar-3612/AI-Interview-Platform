import dotenv from 'dotenv';
import mongoose from 'mongoose';
import RealInterviewHRSession from '../backend/models/RealInterviewHRSession.js';
import RealInterviewHRQuestion from '../backend/models/RealInterviewHRQuestion.js';
dotenv.config();

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    const sessionId = '6a9c5f6948ff1049c71f89bd';
    const s = await RealInterviewHRSession.findOne({ sessionId });
    console.log('Session doc:', s);
    const qs = await RealInterviewHRQuestion.find({ sessionId });
    console.log('Questions count:', qs.length);
    await mongoose.disconnect();
}
run().catch(console.error);
