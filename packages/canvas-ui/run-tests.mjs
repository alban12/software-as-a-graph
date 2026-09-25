import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function findTestFiles(dir) {
  let results = [];
  const list = readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(findTestFiles(fullPath));
    } else if (file.endsWith('.test.mjs')) {
      results.push(fullPath);
    }
  }
  return results;
}

const testFiles = findTestFiles('tests');
console.log(`Running ${testFiles.length} test suites sequentially...\n`);

for (const testFile of testFiles) {
  const result = spawnSync('node', ['--test', testFile], {
    stdio: 'inherit',
    env: process.env
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log('\n✅ All test suites completed successfully!');
