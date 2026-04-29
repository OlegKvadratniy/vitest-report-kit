# 🧪 Test Reporter

[![npm version](https://badge.fury.io/js/test-reporter.svg)](https://badge.fury.io/js/test-reporter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Auto-discover, run tests, and generate beautiful HTML reports with Jira integration.**

## ✨ Features

- 🔍 **Auto-discovery** - Automatically finds Vitest tests
- 📊 **HTML Reports** - Beautiful, filterable test reports
- 🎯 **Jira Integration** - Copy bug reports formatted for Jira
- 🏷️ **Metadata** - Git info, Node version, platform details
- ⚡ **Fast** - Client-side filtering in <10ms
- 🎨 **Modern UI** - Gradients, shadows, responsive design

## 🚀 Quick Start

```bash
npx test-reporter
```

Or install globally:

```bash
npm install -g test-reporter
```

Then run:

```bash
test-reporter
```

## 📦 Installation

```bash
npm install --save-dev test-reporter
```

## 📖 Usage

### CLI Commands

```bash
test-reporter              # Run tests and open report
test-reporter --verbose    # Verbose output
test-reporter --watch      # Watch mode (not implemented)
test-reporter -o ./report  # Custom output directory
test-reporter --init       # Initialize config (prints message only)
test-reporter --help       # Show help
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-h, --help` | Show help message | - |
| `-v, --verbose` | Enable verbose output | `false` |
| `-w, --watch` | Watch mode (not implemented) | `false` |
| `-o, --output=<dir>` | Output directory | `_test_report` |
| `--init` | Initialize config (prints message only) | - |

## 📁 Supported Test Patterns

Auto-discovers test files:

- `*.test.js`, `*.test.mjs`
- `*.spec.js`, `*.spec.mjs`
- `example-tests/**/*.js`, `example-tests/**/*.mjs`

## 🛠️ Supported Frameworks

Automatically detects and uses:

- ✅ **Vitest** (default)

## 📊 Report Features

### HTML Report

- **Filter by Status** - Passed, Failed, Skipped
- **Search** - Filter by test name
- **Metrics** - Total, Passed, Failed counts
- **Pie Chart** - Visual representation
- **Duration** - Test execution time

### Jira Bug Report

Click "Copy for Jira" on failed tests to get:

```markdown
# Test Failure: test name

## Environment
| Field | Value |
|-------|-------|
| **Branch** | main |
| **Commit** | abc1234 |
| **Node** | v25.9.0 |
| **Platform** | linux |

## Preconditions
- Function: `functionName`
- Test case: `test description`

## Steps to Reproduce
1. Open test file: `path/to/test.js`
2. Find test: `test name`
3. Pass input value: `value`
4. Execute: `function(value)`
5. Observe the result

## Expected Result
Function should return: `expected`

## Actual Result
Function returned: `actual`

## Error Details
Assertion failed: `AssertionError: expected 'actual' to be 'expected'`

## 🧪 Example

```javascript
// example-tests/math.test.js
import { describe, it, expect } from 'vitest';

const add = (a, b) => a + b;

describe('Math', () => {
  it('adds two numbers', () => {
    expect(add(2, 3)).toBe(5);
  });
  
  it('handles zero', () => {
    expect(add(0, 0)).toBe(0);
  });
});
```

Run:

```bash
test-reporter
```

## 📈 Performance

| Metric | Value |
|--------|-------|
| Report Size | ~20KB |
| Render Time | <50ms |
| Filter Time | <10ms |
| Total Launch | ~2s |

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Built with [Vitest](https://vitest.dev/)