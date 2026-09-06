import fs from 'fs';
import path from 'path';

const projectRoot = 'c:/Users/Tushar Nagare/Basic To Advance/Projects/Final_year_Project/ai-interview-engine';

const filesToDelete = [
  'backend/routes/interviewRoutes.js',
  'backend/controllers/interviewController.js',
  'backend/services/interviewGenerationService.js',
  'backend/services/interviewCompletionService.js',
  'backend/services/roundGenerators.js',
  'backend/services/roundService.js',
  'backend/services/ai/aiPrompts.js',
  'backend/services/ai/resumeQuestionGenerator.js',
  'backend/services/ai/technicalQuestionGenerator.js',
  'backend/services/ai/hrQuestionGenerator.js',
  'backend/services/ai/codingQuestionGenerator.js',
  'backend/services/ai/followUpGenerator.js',
  'backend/models/InterviewQuestion.js'
];

console.log('=== DELETING EXCLUSIVE REAL INTERVIEW BACKEND FILES ===');

const removed = [];
const missing = [];

for (const relPath of filesToDelete) {
  const fullPath = path.join(projectRoot, relPath);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
    console.log(`✅ Deleted: ${relPath}`);
    removed.push(relPath);
  } else {
    console.log(`⚠️ Not found (already deleted): ${relPath}`);
    missing.push(relPath);
  }
}

console.log(`\nSummary: ${removed.length} files removed.`);
