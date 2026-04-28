#!/usr/bin/env node

/**
 * Main CLI entry point for the test framework
 * Usage: node framework/cli.js [options]
 */

import { runAllTests } from './test-runner.js';

const args = process.argv.slice(2);
const options = {
  help: args.includes('--help') || args.includes('-h'),
  verbose: args.includes('--verbose') || args.includes('-v'),
  watch: args.includes('--watch') || args.includes('-w'),
  output: args.find(a => a.startsWith('--output='))?.split('=')[1] || '_test_report'
};

if (options.help) {
  console.log(`
╔════════════════════════════════════════════════════════╗
║         🧪 Auto Test Runner & Report Generator         ║
╚════════════════════════════════════════════════════════╝

Usage: node framework/cli.js [options]

Options:
  -h, --help         Show this help message
  -v, --verbose      Enable verbose output
  -w, --watch        Watch mode (run tests on file changes)
  --output=<dir>     Output directory for reports (default: _test_report)

Examples:
  node framework/cli.js                  # Run all tests
  node framework/cli.js --verbose        # Run with verbose output
  node framework/cli.js --watch          # Watch mode
  node framework/cli.js --output=report  # Custom output directory

Supported frameworks (auto-detected):
  ✅ Vitest
  ✅ Jest  
  ✅ Mocha
  ✅ Custom test files (*.test.js, *.spec.js)
`);
  process.exit(0);
}

console.log();
console.log('╔════════════════════════════════════════════════════════╗');
console.log('║         🧪 Auto Test Runner & Report Generator         ║');
console.log('╚════════════════════════════════════════════════════════╝');
console.log();

if (options.verbose) {
  console.log('📋 Options:', JSON.stringify(options, null, 2));
  console.log();
}

if (options.watch) {
  console.log('👁️  Watch mode enabled (not yet implemented)');
  console.log('   Running tests once...\n');
}

runAllTests().catch(err => {
  console.error('❌ Fatal error:', err.message);
  if (options.verbose) {
    console.error(err.stack);
  }
  process.exit(1);
});
