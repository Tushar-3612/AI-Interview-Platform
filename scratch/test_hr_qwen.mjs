import { generateHRAI } from '../backend/services/realInterviewAI/hrAI.js';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
    process.env.REAL_INTERVIEW_HR_MODEL = 'qwen/qwen3.8-27b';
    const res = await generateHRAI({
        candidateProfile: {
            fullName: 'Tushar Nagare',
            education: 'Bachelor of Engineering in Computer Science',
            projects: ['AI Resume Matcher', 'Customer Churn']
        },
        count: 5
    });
    console.log('Generated count:', res.length);
    res.forEach((q, idx) => console.log(`Q${idx+1}: [${q.difficulty}] ${q.question}`));
}
test().catch(console.error);
