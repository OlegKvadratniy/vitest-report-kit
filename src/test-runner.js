#!/usr/bin/env node

/**
 * Test Runner - Auto-discovers and runs tests from various frameworks
 * Supports: Vitest, Jest, Mocha, custom test files
 */

import { execSync } from 'child_process';
import { existsSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { globSync } from 'glob';
import os from 'os';
import { generateReport } from './report-generator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const RESULTS_FILE = join(ROOT_DIR, 'test-results.json');
const REPORT_DIR = join(ROOT_DIR, '_test_report');
const REPORT_FILE = join(REPORT_DIR, 'index.html');

// Configuration
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

// Collect environment metadata
async function collectEnvMetadata() {
  const metadata = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    cwd: process.cwd(),
    gitBranch: 'N/A',
    gitCommit: 'N/A'
  };

  try {
    metadata.gitBranch = execSync('git branch --show-current', { 
      stdio: 'pipe', 
      cwd: ROOT_DIR 
    }).toString().trim();
  } catch (e) {}

  try {
    metadata.gitCommit = execSync('git rev-parse --short HEAD', { 
      stdio: 'pipe', 
      cwd: ROOT_DIR 
    }).toString().trim();
  } catch (e) {}

try {
  metadata.hostname = os.hostname();
  metadata.totalMemory = Math.round(os.totalmem() / 1024 / 1024) + ' MB';
} catch (e) {}

  return metadata;
}

// Detect installed test framework
function detectFramework(rootDir) {
  const packageJsonPath = join(rootDir || ROOT_DIR, 'package.json');
  
  if (!existsSync(packageJsonPath)) {
    console.log('⚠️  No package.json found, searching for test files...');
    return null;
  }

  try {
    const packageJson = JSON.parse(execSync(`cat "${packageJsonPath}"`).toString());
    
    // Check dependencies
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    if (allDeps.vitest) return 'vitest';
    if (allDeps.jest) return 'jest';
    if (allDeps.mocha) return 'mocha';

    // Check scripts
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

// Find test files manually
function findTestFiles() {
  const testFiles = [];

  for (const pattern of config.testPatterns) {
    try {
      const files = globSync(pattern, {
        cwd: ROOT_DIR,
        ignore: config.excludePatterns,
        absolute: false
      });
      testFiles.push(...files);
    } catch (e) {}
  }

  return [...new Set(testFiles)];
}

// Run tests with detected framework
async function runTests(framework, rootDir) {
  console.log(`\n🚀 Starting test runner...\n`);
  
  const env = await collectEnvMetadata(rootDir || ROOT_DIR);
  console.log(`📊 Environment:`);
  console.log(`   Node: ${env.nodeVersion}`);
  console.log(`   Platform: ${env.platform}`);
  console.log(`   Git Branch: ${env.gitBranch}`);
  console.log(`   Git Commit: ${env.gitCommit}`);
  console.log(`   Timestamp: ${env.timestamp}`);
  console.log();

  const currentDir = rootDir || ROOT_DIR;
  
  if (!framework) {
    console.log('🔍 No test framework detected, searching for test files...');
    const testFiles = findTestFiles(currentDir);
    
    if (testFiles.length === 0) {
      console.log('❌ No test files found!');
      console.log(' Expected patterns: *.test.js, *.spec.js, tests/**/*.js');
      return null;
    }
    
  if (!framework) {
    console.log('🔍 No test framework detected, searching for test files...');
    const testFiles = findTestFiles(currentDir);
    
    if (testFiles.length === 0) {
      console.log('❌ No test files found!');
      console.log(' Expected patterns: *.test.js, *.spec.js, tests/**/*.js');
      return null;
    }
    
    console.log(`✅ Found ${testFiles.length} test file(s):`);
    testFiles.forEach(f => console.log(` - ${f}`));
    console.log();
    
    // Default to vitest if no framework detected
    framework = 'vitest';
    console.log('💡 Using Vitest as default runner\n');
  } else {
    console.log(`✅ Detected framework: ${framework}\n`);
  }

  const frameworkConfig = config.frameworks[framework];
  if (!frameworkConfig) {
    console.error(`❌ Unsupported framework: ${framework}`);
    return null;
  }

  const RESULTS_FILE = join(currentDir, 'test-results.json');
  const REPORT_DIR = join(currentDir, '_test_report');
  
  // Clean up old results
  if (existsSync(RESULTS_FILE)) {
    rmSync(RESULTS_FILE);
  }

  // Run tests
  const command = frameworkConfig.command.replace('{output}', RESULTS_FILE);
  console.log(`📝 Running: ${command}\n`);

  try {
    execSync(command, {
      cwd: currentDir,
      stdio: 'inherit',
      env: { ...process.env, FORCE_COLOR: '1' }
    });
  } catch (error) {
    // Tests may fail, that's OK - we still want to generate report
    console.log('\n⚠️ Some tests may have failed, continuing with report generation...\n');
  }

  // Verify results file
  if (!existsSync(RESULTS_FILE)) {
    console.error('❌ Test results file not generated!');
    
    // Try to create minimal results from file discovery
    console.log('📝 Creating minimal results from discovered files...');
    const testFiles = findTestFiles(currentDir);
    
    const minimalResults = {
      numTotalTestSuites: testFiles.length,
      numPassedTestSuites: 0,
      numFailedTestSuites: 0,
      testResults: testFiles.map(file => ({
        name: file,
        status: 'unknown',
        assertionResults: []
      }))
    };
    
    writeFileSync(RESULTS_FILE, JSON.stringify(minimalResults, null, 2));
  }
  
  return { framework, env, RESULTS_FILE, REPORT_DIR };
}

// Open report in browser
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

// Main entry point
export async function runAllTests(projectRoot, options = {}) {
  const startTime = Date.now();
  
  // Use provided project root or default to parent directory
  const ROOT_DIR = projectRoot || join(__dirname, '..');
  
  if (!options.help && !options.verbose && !options.watch && !options.init) {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║         🧪 Auto Test Runner & Report Generator         ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log();
  }

  // Detect and run tests
  const framework = detectFramework(ROOT_DIR);
  const result = await runTests(framework, ROOT_DIR);

  if (!result) {
    console.error('\n❌ Failed to run tests');
    process.exit(1);
  }

  // Generate report
  console.log('\n📊 Generating HTML report...\n');
  
  try {
    generateReport(result.RESULTS_FILE, result.REPORT_DIR, result.env);
  } catch (error) {
    console.error('❌ Failed to generate report:', error.message);
    process.exit(1);
  }
  
  // Open in browser
  console.log();
  openReportInBrowser(result.REPORT_DIR);
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n✅ Done in ${duration}s\n`);
}
