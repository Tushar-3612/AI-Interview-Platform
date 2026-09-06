import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../backend/models/User.js';
dotenv.config();

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    let user = await User.findOne({ email: 'tusharnagare2006@gmail.com' });
    const token = jwt.sign({ id: user._id, role: user.role || 'student' }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });

    const sessionId = '6a9c5f6948ff1049c71f89bd';
    const res = await fetch('http://localhost:5000/api/real-interview/hr/generate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            sessionId,
            candidateProfile: {
                candidateName: "Test Student",
                resumeFileName: "resume.pdf",
                skills: ["JavaScript", "React", "Node.js"],
            }
        })
    });

    console.log('Status:', res.status);
    const body = await res.json();
    console.log('Body:', JSON.stringify(body, null, 2));

    await mongoose.disconnect();
}
run().catch(console.error);
