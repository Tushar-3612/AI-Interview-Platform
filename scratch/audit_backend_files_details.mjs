import fs from 'fs';
import path from 'path';

const projectRoot = 'c:/Users/Tushar Nagare/Basic To Advance/Projects/Final_year_Project/ai-interview-engine';

function inspectDir(subDir) {
  const fullPath = path.join(projectRoot, 'backend', subDir);
  if (!fs.existsSync(fullPath)) return;
  console.log(`\n=================== ${subDir.toUpperCase()} ===================`);
  const files = fs.readdirSync(fullPath);
  for (const file of files) {
    const filePath = path.join(fullPath, file);
    if (fs.statSync(filePath).isFile() && file.endsWith('.js')) {
      const content = fs.readFileSync(filePath, 'utf8');
      console.log(`\nFile: backend/${subDir}/${file}`);
      // Find exports or route declarations
      const exports = content.match(/export\s+(const|function|class|default)\s+([a-zA-Z0-9_$]+)/g) || [];
      const routerEndpoints = content.match(/router\.(get|post|put|delete|patch)\(['"]([^'"]+)['"]/g) || [];
      if (exports.length > 0) {
        console.log('  Exports:', exports.slice(0, 10).map(e => e.trim()));
      }
      if (routerEndpoints.length > 0) {
        console.log('  Routes:', routerEndpoints.map(r => r.trim()));
      }
    }
  }
}

inspectDir('routes');
inspectDir('controllers');
inspectDir('services');
inspectDir('models');
