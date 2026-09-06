import fs from 'fs';
import path from 'path';

const frontendDir = 'c:/Users/Tushar Nagare/Basic To Advance/Projects/Final_year_Project/ai-interview-engine/frontend/src';

function scanDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      scanDir(filePath, fileList);
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const allFrontendFiles = scanDir(frontendDir);

console.log('=== FRONTEND FILES CALLING DELETED REAL INTERVIEW ENDPOINTS ===');

const matches = [];

for (const filePath of allFrontendFiles) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relPath = path.relative(path.join(frontendDir, '..'), filePath);
  
  const hits = [];
  if (content.includes('/api/interview')) hits.push('/api/interview');
  if (content.includes('/api/student/interviews')) hits.push('/api/student/interviews');
  if (content.includes('/api/student/results')) hits.push('/api/student/results');

  if (hits.length > 0) {
    matches.push({ relPath, hits });
    console.log(`- ${relPath}: references [${hits.join(', ')}]`);
  }
}

console.log(`\nTotal frontend files needing backend re-wiring later: ${matches.length}`);
