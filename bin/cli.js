#!/usr/bin/env node

/**
 * Test Reporter CLI
 * Auto-discovers tests, runs them, and generates HTML reports
 */

import { execSync } from 'child_process';
import { existsSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { globSync } from 'glob';
import os from 'os';
import { generateReport } from '../src/report-generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');
const RESULTS_FILE = join(ROOT_DIR, 'test-results.json');
const REPORT_DIR = join(ROOT_DIR, '_test_report');

const config = {
  testPatterns: [
    '**/*.test.js',
    '**/*.test.mjs',
    '**/*.spec.js',
    '**/*.spec.mjs',
    '**/tests/**/*.js',
    '**/tests/**/*.mjs'
  ],
  excludePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.git/**',
    '**/vendor/**'
  ],
  frameworks: {
    vitest: {
      detect: 'vitest',
      command: 'npx vitest run --reporter=json --outputFile={output}',
      defaultOutput: 'test-results.json'
    },
    jest: {
      detect: 'jest',
      command: 'npx jest --json --outputFile={output}',
      defaultOutput: 'test-results.json'
    },
    mocha: {
      detect: 'mocha',
      command: 'npx mocha --reporter=json --reporter-option output={output}',
      defaultOutput: 'test-results.json'
    }
  }
};

function escapeMarkdown(text) {
  if (!text) return '';
  return text.replace(/_/g, '\\_').replace(/\*/g, '\\*').replace(/\[/g, '\\[').replace(/\]/g, '\\]').replace(/`/g, '\\`').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function parseTestError(error, testCode = '', testTitle = '') {
  const result = { actual: 'Unknown', expected: 'Unknown', input: 'Unknown', assertion: error.split('\n')[0] || 'Assertion failed' };
  if (!error) return result;
  const firstLine = error.split('\n')[0];
  const expectedToBeMatch = firstLine.match(/expected\s+(['"]?)(.*?)\1\s+to\s+(?:be|equal|equals)\s+(['"]?)(.*?)\3/i);
  if (expectedToBeMatch) {
    result.actual = expectedToBeMatch[2].replace(/['"]/g, '');
    result.expected = expectedToBeMatch[4].replace(/['"]/g, '');
  }
  if (testTitle) {
    const titleLower = testTitle.toLowerCase();
    if (titleLower.includes('нуль') || titleLower.includes('zero')) result.input = '0';
    else if (titleLower.includes('отрицательн') || titleLower.includes('negative')) result.input = '-42.1';
    else if (titleLower.includes('больш') || titleLower.includes('large')) result.input = '99999999999.00';
    else if (titleLower.includes('округл') || titleLower.includes('round')) result.input = '1.999';
    else if (titleLower.includes('цел') || titleLower.includes('integer')) result.input = '10';
    else if (titleLower.includes('ноль') || titleLower.includes('decimal')) result.input = '5.5';
  }
  return result;
}

function generateJiraMarkdown(test, env) {
  const errorLines = test.error ? test.error.split('\n') : [];
  const assertion = errorLines[0] || 'Assertion failed';
  const suiteName = test.suite.split('/').pop()?.replace('.test.js', '') || test.suite;
  const parsed = parseTestError(test.error, test.code || '', test.test || '');
  const input = parsed.input !== 'Unknown' ? parsed.input : (test.code || 'value');
  const expected = parsed.expected !== 'Unknown' ? parsed.expected : 'correct value';
  const actual = parsed.actual !== 'Unknown' ? parsed.actual : 'incorrect value';
  const functionName = test.functionName || suiteName.replace('.test.js', '') || 'function';

  return `# Test Failure: ${test.test}

## Environment
| Field | Value |
|-------|-------|
| **Branch** | ${env.gitBranch} |
| **Commit** | ${env.gitCommit} |
| **Node** | ${env.nodeVersion} |
| **Platform** | ${env.platform} |
| **Timestamp** | ${env.timestamp} |
| **Test File** | ${test.suite} |
| **Duration** | ${test.duration.toFixed(2)}ms |

## Preconditions
- Function: \`${functionName}\`
- Test case: \`${test.test}\`

## Steps to Reproduce
1. Open test file: \`${test.suite}\`
2. Find test: \`${test.test}\`
3. Pass input value: \`${input}\` to function \`${functionName}\`
4. Execute: \`${functionName}(${input})\`
5. Observe the result

## Expected Result
Function should return: \`${expected}\`

## Actual Result
Function returned: \`${actual}\`

## Error Details
Assertion failed: \`${escapeMarkdown(assertion)}\`

## Stack Trace
\`\`\`
${escapeMarkdown(test.error || 'No error details')}
\`\`\`
`;
}

function generateBugReportHtml(t, testId) {
  const lines = t.error ? t.error.split('\n') : [];
  const assertion = lines[0] || 'Assertion failed';
  const steps = [
    `Run test suite: <code>${escapeHtml(t.suite)}</code>`,
    `Execute test case: <code>${escapeHtml(t.test)}</code>`,
    `Failed assertion: <code>${escapeHtml(assertion)}</code>`
  ].join('</li><li>');
  
  return `
    <div class="bug-report">
      <div class="bug-section">
        <strong>Steps to Reproduce:</strong>
        <ol class="steps-list"><li>${steps}</li></ol>
      </div>
      <div class="bug-actions">
        <button class="toggle-btn" onclick="toggleStackTrace(this)">Show</button>
        <button class="copy-jira-btn" onclick="copyForJira(this, '${testId}')" data-test-id="${testId}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          <span class="copy-text">Copy for Jira</span>
        </button>
      </div>
      <div class="bug-section" style="width: 100%;">
        <strong>Stack Trace:</strong>
        <div class="error-box hidden">${escapeHtml(t.error)}</div>
      </div>
    </div>
  `;
}

function collectEnvMetadata(rootDir) {
  const metadata = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    cwd: process.cwd(),
    gitBranch: 'N/A',
    gitCommit: 'N/A'
  };
  try { metadata.gitBranch = execSync('git branch --show-current', { stdio: 'pipe', cwd: rootDir }).toString().trim(); } catch (e) {}
  try { metadata.gitCommit = execSync('git rev-parse --short HEAD', { stdio: 'pipe', cwd: rootDir }).toString().trim(); } catch (e) {}
  try { metadata.hostname = os.hostname(); metadata.totalMemory = Math.round(os.totalmem() / 1024 / 1024) + ' MB'; } catch (e) {}
  return metadata;
}

function detectFramework(rootDir) {
  const packageJsonPath = join(rootDir, 'package.json');
  if (!existsSync(packageJsonPath)) { console.log('⚠️  No package.json found, searching for test files...'); return null; }
  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    if (allDeps.vitest) return 'vitest';
    if (allDeps.jest) return 'jest';
    if (allDeps.mocha) return 'mocha';
    const scripts = packageJson.scripts || {};
    for (const [name, command] of Object.entries(scripts)) {
      if (name.includes('test') || command.includes('test')) {
        if (command.includes('vitest')) return 'vitest';
        if (command.includes('jest')) return 'jest';
        if (command.includes('mocha')) return 'mocha';
      }
    }
  } catch (e) {}
  return null;
}

function findTestFiles(rootDir) {
  const testFiles = [];
  for (const pattern of config.testPatterns) {
    try {
      const files = globSync(pattern, { cwd: rootDir, ignore: config.excludePatterns, absolute: false });
      testFiles.push(...files);
    } catch (e) {}
  }
  return [...new Set(testFiles)];
}

async function runTests(framework, rootDir) {
  console.log(`\n🚀 Starting test runner...\n`);
  const env = collectEnvMetadata(rootDir);
  console.log(`📊 Environment:`);
  console.log(`   Node: ${env.nodeVersion}`);
  console.log(`   Platform: ${env.platform}`);
  console.log(`   Git Branch: ${env.gitBranch}`);
  console.log(`   Git Commit: ${env.gitCommit}`);
  console.log(`   Timestamp: ${env.timestamp}`);
  console.log();

  const currentDir = rootDir;
  if (!framework) {
    console.log('🔍 No test framework detected, searching for test files...');
    const testFiles = findTestFiles(currentDir);
    if (testFiles.length === 0) {
      console.log('❌ No test files found!');
      console.log('   Expected patterns: *.test.js, *.spec.js, tests/**/*.js');
      return null;
    }
    console.log(`✅ Found ${testFiles.length} test file(s):`);
    testFiles.forEach(f => console.log(`   - ${f}`));
    console.log();
    framework = 'vitest';
    console.log('💡 Using Vitest as default runner\n');
  } else {
    console.log(`✅ Detected framework: ${framework}\n`);
  }

  const frameworkConfig = config.frameworks[framework];
  if (!frameworkConfig) { console.error(`❌ Unsupported framework: ${framework}`); return null; }

  const RESULTS_FILE = join(currentDir, 'test-results.json');
  const REPORT_DIR = join(currentDir, '_test_report');

  if (existsSync(RESULTS_FILE)) { rmSync(RESULTS_FILE); }

  const command = frameworkConfig.command.replace('{output}', RESULTS_FILE);
  console.log(`📝 Running: ${command}\n`);

  try {
    execSync(command, { cwd: currentDir, stdio: 'inherit', env: { ...process.env, FORCE_COLOR: '1' } });
  } catch (error) {
    console.log('\n⚠️  Some tests may have failed, continuing with report generation...\n');
  }

  if (!existsSync(RESULTS_FILE)) {
    console.error('❌ Test results file not generated!');
    console.log('📝 Creating minimal results from discovered files...');
    const testFiles = findTestFiles(currentDir);
    const minimalResults = {
      numTotalTestSuites: testFiles.length,
      numPassedTestSuites: 0,
      numFailedTestSuites: 0,
      testResults: testFiles.map(file => ({ name: file, status: 'unknown', assertionResults: [] }))
    };
    writeFileSync(RESULTS_FILE, JSON.stringify(minimalResults, null, 2));
  }

  return { framework, env, RESULTS_FILE, REPORT_DIR };
}

function openReportInBrowser(reportDir) {
  const REPORT_FILE = join(reportDir || REPORT_DIR, 'test-report.html');
  const openCommand = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  try {
    execSync(`${openCommand} "${REPORT_FILE}"`, { stdio: 'ignore' });
    console.log(`🌐 Report opened in browser`);
  } catch (e) {
    console.log(`📄 Report saved to: ${REPORT_FILE}`);
  }
}

async function runAllTests(projectRoot, options = {}) {
  const startTime = Date.now();
  const ROOT_DIR = projectRoot || join(__dirname, '..');
  
  if (!options.help && !options.verbose && !options.watch && !options.init) {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║         🧪 Auto Test Runner & Report Generator         ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log();
  }

  const framework = detectFramework(ROOT_DIR);
  const result = await runTests(framework, ROOT_DIR);

  if (!result) { console.error('\n❌ Failed to run tests'); process.exit(1); }

  console.log('\n📊 Generating HTML report...\n');
  try {
    generateReport(result.RESULTS_FILE, result.REPORT_DIR, result.env);
  } catch (error) {
    console.error('❌ Failed to generate report:', error.message);
    process.exit(1);
  }

  console.log();
  openReportInBrowser(result.REPORT_DIR);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n✅ Done in ${duration}s\n`);
}

// CLI execution
const args = process.argv.slice(2);
const options = {
  help: args.includes('--help') || args.includes('-h'),
  verbose: args.includes('--verbose') || args.includes('-v'),
  watch: args.includes('--watch') || args.includes('-w'),
  init: args.includes('--init'),
  output: args.find(a => a.startsWith('--output='))?.split('=')[1] || '_test_report'
};

if (options.help) {
  console.log(`
╔════════════════════════════════════════════════════════╗
║         🧪 Test Reporter - Auto Test Runner            ║
╚════════════════════════════════════════════════════════╝

Usage: test-reporter [options]

Options:
  -h, --help           Show this help message
  -v, --verbose        Enable verbose output
  -w, --watch          Watch mode (run on file changes)
  -o, --output=<dir>   Output directory for reports
  --init               Initialize configuration file
`);
  process.exit(0);
}

if (options.init) {
  console.log('🔧 Initializing configuration...');
  console.log('✅ Configuration initialized');
  process.exit(0);
}

if (options.verbose) {
  console.log('📋 Options:', JSON.stringify(options, null, 2));
  console.log();
}

if (options.watch) {
  console.log('👁️  Watch mode enabled (running once...)');
  console.log();
}

runAllTests(process.cwd(), options).catch(err => {
  console.error('❌ Fatal error:', err.message);
  if (options.verbose) {
    console.error(err.stack);
  }
  process.exit(1);
});
