import fs from 'fs';
import path from 'path';

const projectRoot = 'c:/Users/Tushar Nagare/Basic To Advance/Projects/Final_year_Project/ai-interview-engine';

function scanDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (!filePath.includes('node_modules') && !filePath.includes('.git') && !filePath.includes('.gemini')) {
        scanDir(filePath, fileList);
      }
    } else if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.mjs')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const allFiles = scanDir(projectRoot);

const interviewTargetFiles = [
  'interviewRoutes.js',
  'interviewController.js',
  'interviewGenerationService.js',
  'interviewCompletionService.js',
  'aiPrompts.js',
  'aiClient.js',
  'Interview.js',
  'InterviewQuestion.js',
  'Answer.js',
  'Result.js',
  'codeExecutionController.js',
  'codeExecution.js',
  'judge0Service.js',
  'resumeParser.js'
];

console.log('--- SCANNING REFERENCES TO REAL INTERVIEW TARGET FILES ---');

for (const target of interviewTargetFiles) {
  const references = [];
  for (const filePath of allFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes(target.replace('.js', '')) || content.includes(target)) {
      const relPath = path.relative(projectRoot, filePath);
      references.push(relPath);
    }
  }
  console.log(`\nTarget: ${target} (Referenced in ${references.length} files)`);
  references.forEach(r => console.log(`   - ${r}`));
}
