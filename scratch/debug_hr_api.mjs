import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../backend/models/User.js';
import RealInterviewHRSession from '../backend/models/RealInterviewHRSession.js';
import RealInterviewHRQuestion from '../backend/models/RealInterviewHRQuestion.js';
dotenv.config();

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    let user = await User.findOne({ email: 'tushar@example.com' });
    if (!user) {
        user = await User.findOne();
    }
    console.log('Using User:', user._id, user.email);

    const token = jwt.sign(
        { id: user._id, email: user.email, role: user.role || 'student' },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '1d' }
    );

    const testSessionId = `test_hr_session_${Date.now()}`;
    console.log('Testing session:', testSessionId);

    const response = await fetch('http://localhost:5000/api/real-interview/hr/generate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            sessionId: testSessionId,
            candidateProfile: {
                fullName: 'Tushar Nagare',
                education: 'Bachelor of Engineering in Computer Science',
                skills: ['Python', 'Node.js', 'React'],
                projects: [{ name: 'AI-Powered Resume Parsing and Job Matching System' }]
            }
        })
    });

    console.log('HTTP Status:', response.status);
    const text = await response.text();
    console.log('Response body:', text);

    await mongoose.disconnect();
}

run().catch(console.error);
