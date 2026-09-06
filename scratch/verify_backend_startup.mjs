import fs from 'fs';
import path from 'path';

console.log('=== TESTING BACKEND ROUTE & CONTROLLER IMPORTS ===');

async function testImports() {
  try {
    await import('../backend/config/db.js');
    console.log('✅ db.js import OK');
    await import('../backend/routes/auth.js');
    console.log('✅ routes/auth.js import OK');
    await import('../backend/routes/admin.js');
    console.log('✅ routes/admin.js import OK');
    await import('../backend/routes/student.js');
    console.log('✅ routes/student.js import OK');
    await import('../backend/routes/company.js');
    console.log('✅ routes/company.js import OK');
    await import('../backend/routes/mockInterviewRoutes.js');
    console.log('✅ routes/mockInterviewRoutes.js import OK');
    await import('../backend/routes/codeExecution.js');
    console.log('✅ routes/codeExecution.js import OK');
    await import('../backend/routes/aiEvaluation.js');
    console.log('✅ routes/aiEvaluation.js import OK');
    console.log('🎉 ALL BACKEND IMPORTS VERIFIED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Import Error:', err);
    process.exit(1);
  }
}

testImports();
