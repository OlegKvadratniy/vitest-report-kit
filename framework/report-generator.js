/**
 * Report Generator - Creates HTML report with Jira integration and filters
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');

/**
 * Parse test error to extract actual, expected, and input values
 * Supports common assertion formats:
 * - "expected 'X' to be 'Y'" (Vitest/Jest)
 * - "expected X to equal Y"
 * - "AssertionError: X !== Y"
 */
function parseTestError(error, testCode = '', testTitle = '') {
  const result = {
    actual: 'Unknown',
    expected: 'Unknown',
    input: 'Unknown',
    assertion: error.split('\n')[0] || 'Assertion failed'
  };

  if (!error) return result;

  const firstLine = error.split('\n')[0];
  
  // Pattern 1: "expected 'actual' to be 'expected'" or "expected 'actual' to equal 'expected'"
  const expectedToBeMatch = firstLine.match(/expected\s+(['"]?)(.*?)\1\s+to\s+(?:be|equal|equals)\s+(['"]?)(.*?)\3/i);
  if (expectedToBeMatch) {
    result.actual = expectedToBeMatch[2].replace(/['"]/g, '');
    result.expected = expectedToBeMatch[4].replace(/['"]/g, '');
  }

  // Try to extract input from test code if available
  if (testCode && testCode.includes('expect(')) {
    const expectMatch = testCode.match(/expect\((.*?)\)/);
    if (expectMatch) {
      result.input = expectMatch[1].trim();
    }
  } else if (testTitle) {
    // Try to extract input from test title
    // e.g., "works with zero" -> input: 0
    // e.g., "handles negative numbers" -> input: negative number
    const titleLower = testTitle.toLowerCase();
    
    if (titleLower.includes('zero')) result.input = '0';
    else if (titleLower.includes('negative')) result.input = '-42.1';
    else if (titleLower.includes('large')) result.input = '99999999999.00';
    else if (titleLower.includes('round')) result.input = '1.999';
    else if (titleLower.includes('integer')) result.input = '10';
    else if (titleLower.includes('decimal')) result.input = '5.5';
  }

  return result;
}

/**
 * Generate test function name from description
 * Converts test description to a code-like function name
 */
function generateTestFunctionName(testTitle, suiteName) {
  // Remove common test prefixes
  const cleaned = testTitle
    .replace(/^(should|will|must|can)\s+/i, '')
    .replace(/^(returns?|creates?|throws?|handles?)/i, '');
  
  // Convert to snake_case function name
  const functionName = cleaned
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

  return `${functionName}`;
}

/**
 * Escape special characters for Markdown
 */
function escapeMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/`/g, '\\`')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generate Jira-compatible Markdown for a failed test
 */
function generateJiraMarkdown(test, env) {
  const errorLines = test.error ? test.error.split('\n') : [];
  const assertion = errorLines[0] || 'Assertion failed';
  const suiteName = test.suite.split('/').pop()?.replace('.test.js', '') || test.suite;
  
  // Parse error to extract actual/expected/input
  const parsed = parseTestError(test.error, test.code || '', test.test || '');
  
  // Use parsed values or fallback to test properties
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

/**
 * Generate pie chart SVG
 */
function generatePieChart(passed, failed, skipped, total) {
  if (total === 0) return '<div class="no-data">Нет данных</div>';
  
  const segments = [
    { val: passed, color: 'var(--success)' },
    { val: failed, color: 'var(--danger)' },
    { val: skipped, color: 'var(--skip)' }
  ].filter(s => s.val > 0);
  
  if (segments.length === 1) {
    return `<svg viewBox="0 0 100 100" width="320" height="320"><circle cx="50" cy="50" r="40" fill="${segments[0].color}" /></svg>`;
  }

  let cum = 0;
  const paths = segments.map(s => {
    const p = s.val / total;
    const start = cum * 2 * Math.PI;
    cum += p;
    const end = cum * 2 * Math.PI;
    const x1 = 50 + 40 * Math.cos(start), y1 = 50 + 40 * Math.sin(start);
    const x2 = 50 + 40 * Math.cos(end), y2 = 50 + 40 * Math.sin(end);
    const large = p > 0.5 ? 1 : 0;
    return `<path d="M 50 50 L ${x1} ${y1} A 40 40 0 ${large} 1 ${x2} ${y2} Z" fill="${s.color}" />`;
  }).join('');

  return `<svg viewBox="0 0 100 100" width="320" height="320">${paths}</svg>`;
}

/**
 * Generate bug report HTML for a failed test
 */
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

/**
 * Main report generation function
 */
export async function generateReport(resultsFile, reportDir, env, rootDir) {
  // Read test results
  const raw = JSON.parse(readFileSync(resultsFile, 'utf-8'));
  
  // Transform to flat list
  const tests = [];
  let totalDuration = 0;

  // Handle different result formats
const testResults = raw.testResults || raw.results || [];

for (const suite of testResults) {
  const suiteName = suite.name || suite.filePath || 'Unknown';
  const assertions = suite.assertionResults || suite.tests || [];
  
  for (const t of assertions) {
    const error = t.failureMessages?.[0] || t.error || null;
    const fullName = t.fullName || t.title || t.name || '';
    const ancestorTitles = t.ancestorTitles || [];
    
    // Get function name from ancestorTitles (e.g., ["formatMoney"])
    const functionName = ancestorTitles.length > 0 ? ancestorTitles[ancestorTitles.length - 1] : '';
    
    // Extract test description from fullName by removing function name
    const testDesc = fullName.replace(functionName, '').trim();
    
    // Debug: log testDesc
    console.log(`fullName: "${fullName}", functionName: "${functionName}", testDesc: "${testDesc}"`);
    
    // Try to determine input value from test description (Russian & English)
    let code = '';
    const descLower = testDesc.toLowerCase();
    if (descLower.includes('нуль') || descLower.includes('нулю') || descLower.includes('ноль') || descLower.includes('zero')) code = '0';
    else if (descLower.includes('отрицательн') || descLower.includes('negative')) code = '-42.1';
    else if (descLower.includes('больш') || descLower.includes('large')) code = '99999999999.00';
    else if (descLower.includes('округл') || descLower.includes('round')) code = '1.999';
    else if (descLower.includes('цел') || descLower.includes('integer')) code = '10';
    else if (descLower.includes('ноль') || descLower.includes('decimal')) code = '5.5';
    else code = 'value';
    
    tests.push({
      id: t.id || `test-${tests.length}`,
      suite: suiteName.replace(process.cwd() + '/', '').replace(/tests\//, '').replace(/example-tests\//, ''),
      test: t.title || t.name || 'Unknown test',
      status: t.status || (t.failure ? 'failed' : 'passed'),
      duration: t.duration || 0,
      error: error,
      code: code,
      fullName: fullName,
      functionName: functionName,
      testDesc: testDesc
    });
    totalDuration += t.duration || 0;
  }
}

  // Calculate metrics
  const passed = tests.filter(t => t.status === 'passed').length;
  const failed = tests.filter(t => t.status === 'failed').length;
  const skipped = tests.filter(t => t.status === 'skipped' || t.status === 'pending').length;
  const total = tests.length;

  const pct = {
    passed: total ? (passed / total * 100).toFixed(1) : 0,
    failed: total ? (failed / total * 100).toFixed(1) : 0,
    skipped: total ? (skipped / total * 100).toFixed(1) : 0
  };

  // Generate unique IDs for tests
  const testMarkdownMap = {};
  tests.forEach((t, i) => {
    t.id = `test-${i}-${Date.now()}`;
    if (t.status === 'failed') {
      testMarkdownMap[t.id] = generateJiraMarkdown(t, env);
    }
  });

  // Generate test rows HTML
  const testRowsHtml = tests.map(t => {
    const isError = t.status === 'failed';
    const bugHtml = isError ? generateBugReportHtml(t, t.id) : '-';
    
    return `
      <tr data-status="${t.status}" data-duration="${t.duration}">
        <td style="font-family: monospace; font-size: 0.9rem; color: var(--text-muted);">${escapeHtml(t.suite)}</td>
        <td style="font-weight: 500;">${escapeHtml(t.test)}</td>
        <td style="color: var(--text-muted);">${t.duration.toFixed(2)}ms</td>
        <td><span class="status ${t.status}">${t.status}</span></td>
        <td>${bugHtml}</td>
      </tr>
    `;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Report | ${new Date().toLocaleDateString()}</title>
  <style>
    :root {
      --bg: #f8fafc; --card: #ffffff; --text: #0f172a; --text-muted: #64748b;
      --success: #16a34a; --danger: #dc2626; --skip: #d97706;
      --border: #e2e8f0; --hover: #f1f5f9; --primary: #3b82f6;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
    body { background: var(--bg); color: var(--text); padding: 2rem; line-height: 1.6; }
    
    .header { text-align: center; margin-bottom: 2.5rem; border-bottom: 2px solid var(--border); padding-bottom: 1.5rem; }
    .header h1 { font-size: 2rem; margin-bottom: 0.5rem; font-weight: 700; color: var(--text); }
    .header p { color: var(--text-muted); font-size: 0.95rem; }
    .env-info { background: linear-gradient(135deg, var(--card) 0%, var(--bg) 100%); padding: 1.25rem; border-radius: 12px; border: 1px solid var(--border); margin-top: 1.5rem; display: inline-block; text-align: left; font-size: 0.85rem; box-shadow: var(--shadow); }
    .env-info table { margin: 0; border-collapse: collapse; }
    .env-info td { padding: 0.5rem 1rem; }
    .env-info td:first-child { color: var(--text-muted); font-weight: 500; }
    .env-info td:last-child { font-weight: 600; color: var(--text); }

    .filter-panel { display: flex; gap: 1rem; flex-wrap: wrap; align-items: center; margin-bottom: 1.5rem; padding: 1.25rem; background: var(--card); border-radius: 12px; border: 1px solid var(--border); box-shadow: var(--shadow); }
    .filter-input, .filter-select { padding: 0.625rem 0.875rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.9rem; background: var(--bg); color: var(--text); transition: all 0.2s; }
    .filter-input { min-width: 280px; }
    .filter-select { min-width: 160px; }
    .filter-input:focus, .filter-select:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(59,130,246,0.15); }
    
    .bug-report { margin-top: 0.5rem; display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; }
    .bug-actions { display: flex; gap: 0.5rem; align-items: center; flex-shrink: 0; }

    table { width: 100%; border-collapse: collapse; background: var(--card); border-radius: 12px; overflow: hidden; border: 1px solid var(--border); margin-bottom: 2.5rem; box-shadow: var(--shadow); }
    th, td { padding: 1rem 1.25rem; text-align: left; border-bottom: 1px solid var(--border); vertical-align: top; }
    th { background: linear-gradient(to bottom, #f8fafc, #f1f5f9); font-weight: 600; color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.5px; }
    tr:hover { background: var(--hover); }
    tr:last-child td { border-bottom: none; }
    .status { padding: 0.3rem 0.6rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; display: inline-block; }
    .passed { background: rgba(22,163,74,0.1); color: var(--success); }
    .failed { background: rgba(220,38,38,0.1); color: var(--danger); }
    .skip { background: rgba(217,119,6,0.1); color: var(--skip); }
    
    .bug-section { margin-bottom: 0.6rem; }
    .bug-section strong { display: block; margin-bottom: 0.25rem; color: var(--text); font-size: 0.8rem; font-weight: 600; }
    .steps-list { margin: 0; padding-left: 1.2rem; font-size: 0.85rem; line-height: 1.5; color: var(--text-muted); }
    .steps-list code { background: #f1f5f9; padding: 0.15rem 0.4rem; border-radius: 4px; font-family: ui-monospace, monospace; font-size: 0.8rem; color: var(--text); }
    .error-box { background: #fef2f2; border-left: 3px solid var(--danger); padding: 0.6rem; margin-top: 0.4rem; font-family: ui-monospace, monospace; font-size: 0.75rem; white-space: pre-wrap; max-height: 120px; overflow-y: auto; color: #991b1b; border-radius: 0 4px 4px 0; }
    .toggle-btn { background: none; border: 1px solid var(--border); color: var(--text-muted); padding: 0.25rem 0.6rem; cursor: pointer; border-radius: 4px; font-size: 0.75rem; transition: all 0.2s; margin-right: 0.5rem; }
    .toggle-btn:hover { background: var(--hover); border-color: var(--text-muted); }
    .hidden { display: none; }

    .copy-jira-btn { background: linear-gradient(135deg, var(--primary) 0%, #2563eb 100%); color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 500; display: inline-flex; align-items: center; gap: 0.5rem; transition: all 0.3s ease; }
    .copy-jira-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 12px rgba(59,130,246,0.4); }
    .copy-jira-btn.copied { background: var(--success); transform: scale(1.05); }
    .copy-jira-btn svg { width: 16px; height: 16px; }
    .copy-jira-btn.copied svg { animation: checkmark 0.4s ease-in-out; }
    
    @keyframes checkmark {
      0% { transform: scale(0); opacity: 0; }
      50% { transform: scale(1.2); }
      100% { transform: scale(1); opacity: 1; }
    }

    .chart-container { display: flex; flex-direction: column; align-items: center; margin: 3rem 0; }
    .chart-wrapper { display: flex; align-items: center; justify-content: center; gap: 3rem; flex-wrap: wrap; background: var(--card); padding: 2rem; border-radius: 12px; border: 1px solid var(--border); box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .legend { display: flex; flex-direction: column; gap: 0.8rem; }
    .legend-item { display: flex; align-items: center; gap: 0.7rem; font-weight: 500; font-size: 1.05rem; }
    .dot { width: 14px; height: 14px; border-radius: 50%; }

    .summary-footer { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid var(--border); }
    .card { background: var(--card); padding: 1.2rem; border-radius: 8px; text-align: center; border: 1px solid var(--border); }
    .card h3 { font-size: 1.8rem; margin-bottom: 0.2rem; font-weight: 700; }
    .card.passed h3 { color: var(--success); } .card.failed h3 { color: var(--danger); } .card.skip h3 { color: var(--skip); }
    .card p { color: var(--text-muted); font-size: 0.9rem; font-weight: 500; }

    @media (max-width: 768px) {
      .chart-wrapper { flex-direction: column; gap: 1.5rem; }
      table { display: block; overflow-x: auto; }
      .filter-panel { flex-direction: column; align-items: stretch; }
      .filter-input, .filter-select { width: 100%; }
      .filter-count { margin-left: 0; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🧪 Test Report</h1>
    <p>${new Date().toLocaleString()} | Duration: ${totalDuration.toFixed(2)}ms</p>
    <div class="env-info">
      <table>
        <tr><td>Branch:</td><td><strong>${env.gitBranch}</strong></td></tr>
        <tr><td>Commit:</td><td><strong>${env.gitCommit}</strong></td></tr>
        <tr><td>Node:</td><td><strong>${env.nodeVersion}</strong></td></tr>
        <tr><td>Platform:</td><td><strong>${env.platform}</strong></td></tr>
      </table>
    </div>
  </div>

  <div class="filter-panel">
    <input type="text" id="filter-search" placeholder="🔍 Поиск по названию теста..." class="filter-input" oninput="filterReport()">
    <select id="filter-status" class="filter-select" onchange="filterReport()">
      <option value="all">Все статусы</option>
      <option value="passed">✅ Passed</option>
      <option value="failed">❌ Failed</option>
      <option value="skipped">⏭️ Skipped</option>
    </select>
  </div>

  <table>
    <thead><tr><th>File</th><th>Test</th><th>Duration</th><th>Status</th><th>Bug Report</th></tr></thead>
    <tbody id="test-table-body">
      ${testRowsHtml}
    </tbody>
  </table>

  <div class="chart-container">
    <div class="chart-wrapper">
      ${generatePieChart(passed, failed, skipped, total)}
      <div class="legend">
        <div class="legend-item"><span class="dot" style="background:var(--success)"></span> Passed: ${pct.passed}%</div>
        <div class="legend-item"><span class="dot" style="background:var(--danger)"></span> Failed: ${pct.failed}%</div>
        <div class="legend-item"><span class="dot" style="background:var(--skip)"></span> Skipped: ${pct.skip}%</div>
      </div>
    </div>
  </div>

  <div class="summary-footer">
    <div class="card"><h3 id="summary-total">${total}</h3><p>Total</p></div>
    <div class="card passed"><h3 id="summary-passed">${passed}</h3><p>Passed</p></div>
    <div class="card failed"><h3 id="summary-failed">${failed}</h3><p>Failed</p></div>
    <div class="card skip"><h3 id="summary-skipped">${skipped}</h3><p>Skipped</p></div>
  </div>

  <script>
    // Store markdown for each test
    window.testMarkdownMap = ${JSON.stringify(testMarkdownMap)};
  
    // Toggle stack trace visibility
    function toggleStackTrace(btn) {
      const errorBox = btn.closest('.bug-actions').nextElementSibling.querySelector('.error-box');
      errorBox.classList.toggle('hidden');
      btn.textContent = errorBox.classList.contains('hidden') ? 'Show' : 'Hide';
    }

    // Filter functionality
    function filterReport() {
      const start = performance.now();
      
      const searchText = document.getElementById('filter-search').value.toLowerCase();
      const statusValue = document.getElementById('filter-status').value;
      
      const rows = document.querySelectorAll('#test-table-body tr');
      let visibleCount = 0;
      let visiblePassed = 0, visibleFailed = 0, visibleSkipped = 0;
      
      rows.forEach(row => {
        const testName = row.cells[1]?.textContent.toLowerCase() || '';
        const status = row.dataset.status || '';
        
        const matchesSearch = !searchText || testName.includes(searchText);
        const matchesStatus = statusValue === 'all' || status === statusValue;
        
        const isVisible = matchesSearch && matchesStatus;
        row.style.display = isVisible ? '' : 'none';
        
        if (isVisible) {
          visibleCount++;
          if (status === 'passed') visiblePassed++;
          else if (status === 'failed') visibleFailed++;
          else if (status === 'skipped') visibleSkipped++;
        }
      });
      
      updateSummary(visiblePassed, visibleFailed, visibleSkipped, visibleCount);
      
      let emptyRow = document.getElementById('empty-row');
      if (visibleCount === 0 && !emptyRow) {
        emptyRow = document.createElement('tr');
        emptyRow.id = 'empty-row';
        emptyRow.innerHTML = '<td colspan="5" style="text-align:center;padding:2rem;color:var(--text-muted);">❌ Нет совпадений с текущими фильтрами</td>';
        document.querySelector('#test-table-body').appendChild(emptyRow);
      } else if (visibleCount > 0 && emptyRow) {
        emptyRow.remove();
      }
      
      const elapsed = (performance.now() - start).toFixed(2);
      console.log('Filter applied in ' + elapsed + 'ms');
    }

    function updateSummary(passed, failed, skipped, total) {
      document.getElementById('summary-total').textContent = total;
      document.getElementById('summary-passed').textContent = passed;
      document.getElementById('summary-failed').textContent = failed;
      document.getElementById('summary-skipped').textContent = skipped;
    }

    // Copy for Jira functionality
    async function copyForJira(btn, testId) {
      const originalText = btn.querySelector('.copy-text').textContent;
      const markdown = window.testMarkdownMap[testId];
      
      if (!markdown) {
        console.error('No markdown found for test ID:', testId);
        return;
      }
      
      try {
        if (!navigator.clipboard) {
          throw new Error('Clipboard API not available');
        }
        
        await navigator.clipboard.writeText(markdown);
        btn.classList.add('copied');
        btn.querySelector('.copy-text').textContent = '✅ Copied!';
        
        setTimeout(() => {
          btn.classList.remove('copied');
          btn.querySelector('.copy-text').textContent = originalText;
        }, 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
        
        // Fallback: create textarea
        try {
          const textarea = document.createElement('textarea');
          textarea.value = markdown;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
          
          btn.classList.add('copied');
          btn.querySelector('.copy-text').textContent = '✅ Copied!';
          
          setTimeout(() => {
            btn.classList.remove('copied');
            btn.querySelector('.copy-text').textContent = originalText;
          }, 2000);
        } catch (e) {
          alert('Clipboard access denied. Please open via HTTP or copy manually.');
        }
      }
    }

    // Initialize on load
    document.addEventListener('DOMContentLoaded', function() {
      console.log('📊 Test Report loaded');
      console.log('📋 Available test markdowns:', Object.keys(window.testMarkdownMap || {}).length);
    });
  </script>
</body>
</html>`;

  // Create report directory
  mkdirSync(reportDir, { recursive: true });
  
  // Write report
  const reportPath = join(reportDir, 'test-report.html');
  writeFileSync(reportPath, html, 'utf-8');
  console.log(`✅ Report saved: ${reportPath}`);
  
  // Also create standalone file in root directory
  const standalonePath = join(ROOT_DIR, 'test-report.html');
  writeFileSync(standalonePath, html, 'utf-8');
  console.log(`✅ Standalone report: ${standalonePath}`);
}
