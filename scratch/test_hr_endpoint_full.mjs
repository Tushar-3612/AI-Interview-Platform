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

    let user = await User.findOne({ email: 'tusharnagare2006@gmail.com' });
    if (!user) user = await User.findOne();
    console.log('Using User:', user._id, user.email);

    const token = jwt.sign(
        { id: user._id, email: user.email, role: user.role || 'student' },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '1d' }
    );

    const testSessionId = `test_hr_session_${Date.now()}`;
    console.log('\n--- 1. TESTING FRESH HR GENERATION ---');
    console.log('Session ID:', testSessionId);

    const res1 = await fetch('http://localhost:5000/api/real-interview/hr/generate', {
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
                skills: ['Python', 'Node.js', 'React', 'FastAPI'],
                projects: [
                    { name: 'AI-Powered Resume Parsing and Job Matching System' },
                    { name: 'Customer Churn Prediction System' }
                ]
            }
        })
    });

    console.log('HTTP Status (Fresh):', res1.status);
    const data1 = await res1.json();
    console.log('Success:', data1.success);
    console.log('Reused:', data1.reused);
    console.log('Questions Count:', data1.questions?.length || data1.count);
    if (data1.questions && data1.questions.length > 0) {
        data1.questions.forEach((q, idx) => {
            console.log(`Q${idx + 1} [${q.difficulty} | ${q.category}]: ${q.question} (Source: ${q.source})`);
        });
    }

    // Verify DB
    const dbQs = await RealInterviewHRQuestion.find({ sessionId: testSessionId }).sort({ orderIndex: 1 });
    console.log('\nDatabase Check: Found', dbQs.length, 'questions in MongoDB');
    console.log('All questions source = AI_PROVIDER:', dbQs.every(q => q.source === 'AI_PROVIDER'));

    console.log('\n--- 2. TESTING IDEMPOTENCY (SECOND CALL) ---');
    const res2 = await fetch('http://localhost:5000/api/real-interview/hr/generate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            sessionId: testSessionId,
            candidateProfile: {
                fullName: 'Tushar Nagare'
            }
        })
    });

    console.log('HTTP Status (Idempotent):', res2.status);
    const data2 = await res2.json();
    console.log('Success:', data2.success);
    console.log('Reused:', data2.reused);
    console.log('Questions Count:', data2.questions?.length);

    await mongoose.disconnect();
}

run().catch(console.error);
