const balanceEl = document.getElementById('balance');
const moneyPlusEl = document.getElementById('money-plus');
const moneyMinusEl = document.getElementById('money-minus');
const savingsRateEl = document.getElementById('savings-rate');
const listEl = document.getElementById('list');
const form = document.getElementById('form');
const textInput = document.getElementById('text');
const amountInput = document.getElementById('amount');
const typeSelect = document.getElementById('type');
const categorySelect = document.getElementById('category');
const dateInput = document.getElementById('date');
const filterCategory = document.getElementById('filter-category');
const filterPeriod = document.getElementById('filter-period');
const themeToggle = document.getElementById('theme-toggle');
const statsBtn = document.getElementById('stats-btn');
const settingsBtn = document.getElementById('settings-btn');
const statsModal = document.getElementById('stats-modal');
const settingsModal = document.getElementById('settings-modal');
const statsModalClose = document.getElementById('stats-modal-close');
const settingsModalClose = document.getElementById('settings-modal-close');
const exportBtn = document.getElementById('export-btn');
const clearAllBtn = document.getElementById('clear-all-btn');
const toast = document.getElementById('toast');
const depositBalanceEl = document.getElementById('deposit-balance');
const depositAmountInput = document.getElementById('deposit-amount');
const depositTermSelect = document.getElementById('deposit-term');
const interestRateEl = document.getElementById('interest-rate');
const monthlyIncomeEl = document.getElementById('monthly-income');
const totalReturnEl = document.getElementById('total-return');
const categoryLimitsContainer = document.getElementById('category-limits');
const categoryBreakdownEl = document.getElementById('category-breakdown');

const categories = {
  salary: { icon: 'fa-money-bill-wave', color: '#10b981', name: 'Salary' },
  food: { icon: 'fa-utensils', color: '#f59e0b', name: 'Food' },
  transport: { icon: 'fa-car', color: '#3b82f6', name: 'Transport' },
  entertainment: { icon: 'fa-film', color: '#8b5cf6', name: 'Entertainment' },
  shopping: { icon: 'fa-shopping-bag', color: '#ec4899', name: 'Shopping' },
  bills: { icon: 'fa-file-invoice-dollar', color: '#64748b', name: 'Bills' },
  health: { icon: 'fa-heartbeat', color: '#ef4444', name: 'Health' },
  other: { icon: 'fa-box', color: '#14b8a6', name: 'Other' }
};

const localStorageTransactions = JSON.parse(localStorage.getItem('transactions'));
const localStorageSettings = JSON.parse(localStorage.getItem('settings'));

let transactions = localStorageTransactions || [];
let settings = localStorageSettings || {
  categoryLimits: {},
  theme: 'light'
};

if (settings.theme === 'dark') {
  document.documentElement.setAttribute('data-theme', 'dark');
  themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
}

dateInput.valueAsDate = new Date();

function generateID() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.add('active');
  setTimeout(() => toast.classList.remove('active'), 3000);
}

function addTransaction(e) {
  e.preventDefault();

  if (textInput.value.trim() === '' || amountInput.value.trim() === '') {
    showToast('Please enter description and amount', true);
    return;
  }

  const amount = parseFloat(amountInput.value);
  if (isNaN(amount) || amount <= 0) {
    showToast('Please enter a valid amount', true);
    return;
  }

  const transaction = {
    id: generateID(),
    text: textInput.value.trim(),
    amount: typeSelect.value === 'expense' ? -Math.abs(amount) : Math.abs(amount),
    category: categorySelect.value,
    date: dateInput.value || new Date().toISOString().split('T')[0]
  };

  transactions.push(transaction);
  updateLocalStorage();
  init();
  
  textInput.value = '';
  amountInput.value = '';
  
  showToast('Transaction added successfully!');
}

function removeTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  updateLocalStorage();
  init();
  showToast('Transaction removed');
}

function updateValues() {
  const amounts = transactions.map(t => t.amount);
  
  const total = amounts.reduce((acc, item) => acc + item, 0);
  const income = amounts
    .filter(item => item > 0)
    .reduce((acc, item) => acc + item, 0);
  const expense = Math.abs(
    amounts.filter(item => item < 0).reduce((acc, item) => acc + item, 0)
  );
  
  const savingsRate = income > 0 ? ((income - expense) / income * 100) : 0;
  
  balanceEl.textContent = formatMoney(total);
  moneyPlusEl.textContent = `+${formatMoney(income)}`;
  moneyMinusEl.textContent = `-${formatMoney(expense)}`;
  savingsRateEl.textContent = `${savingsRate.toFixed(1)}%`;
  
  depositBalanceEl.textContent = formatMoney(total);
  
  const now = new Date();
  const thisMonth = transactions.filter(t => {
    const tDate = new Date(t.date);
    return tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
  });
  const lastMonth = transactions.filter(t => {
    const tDate = new Date(t.date);
    const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    return tDate.getMonth() === lastMonth && tDate.getFullYear() === lastMonthYear;
  });
  
  const thisMonthTotal = thisMonth.reduce((acc, t) => acc + t.amount, 0);
  const lastMonthTotal = lastMonth.reduce((acc, t) => acc + t.amount, 0);
  
  const trendEl = document.getElementById('balance-trend');
  if (lastMonthTotal !== 0) {
    const percentChange = ((thisMonthTotal - lastMonthTotal) / Math.abs(lastMonthTotal)) * 100;
    const icon = percentChange >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';
    trendEl.innerHTML = `<i class="fas ${icon}"></i> <span>${Math.abs(percentChange).toFixed(1)}%</span> this month`;
    trendEl.style.color = percentChange >= 0 ? 'var(--success)' : 'var(--danger)';
  } else {
    trendEl.innerHTML = '<i class="fas fa-minus"></i> <span>0%</span> this month';
  }
}

function formatMoney(amount) {
  return `$${amount.toFixed(2)}`;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = now - date;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function addTransactionDOM(transaction) {
  const sign = transaction.amount < 0 ? '-' : '+';
  const item = document.createElement('li');
  item.classList.add(transaction.amount < 0 ? 'minus' : 'plus');
  
  const category = categories[transaction.category] || categories.other;
  
  item.innerHTML = `
    <div class="transaction-left">
      <div class="transaction-icon ${transaction.category}">
        <i class="fas ${category.icon}"></i>
      </div>
      <div class="transaction-info">
        <div class="transaction-text">${escapeHtml(transaction.text)}</div>
        <div class="transaction-date">${formatDate(transaction.date)}</div>
        <span class="transaction-category">${category.name}</span>
      </div>
    </div>
    <div class="transaction-right">
      <span class="transaction-amount ${transaction.amount < 0 ? 'minus' : 'plus'}">
        ${sign}$${Math.abs(transaction.amount).toFixed(2)}
      </span>
      <button class="delete-btn" onclick="removeTransaction('${transaction.id}')">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `;
  
  listEl.appendChild(item);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getFilteredTransactions() {
  let filtered = [...transactions];
  
  const categoryValue = filterCategory.value;
  if (categoryValue !== 'all') {
    filtered = filtered.filter(t => t.category === categoryValue);
  }
  
  const periodValue = filterPeriod.value;
  const now = new Date();
  
  if (periodValue !== 'all') {
    filtered = filtered.filter(t => {
      const tDate = new Date(t.date);
      const diffTime = now - tDate;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      switch (periodValue) {
        case 'week': return diffDays <= 7;
        case 'month': return tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
        case 'year': return tDate.getFullYear() === now.getFullYear();
        default: return true;
      }
    });
  }
  
  return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
}

function init() {
  listEl.innerHTML = '';
  
  const filtered = getFilteredTransactions();
  
  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-receipt"></i>
        <p>No transactions found</p>
      </div>
    `;
  } else {
    filtered.forEach(addTransactionDOM);
  }
  
  updateValues();
  updateStatsModal();
  updateCategoryLimits();
  calculateDeposit();
}

function updateLocalStorage() {
  localStorage.setItem('transactions', JSON.stringify(transactions));
  localStorage.setItem('settings', JSON.stringify(settings));
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
  themeToggle.innerHTML = isDark ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
  settings.theme = isDark ? 'light' : 'dark';
  updateLocalStorage();
  showToast(`Switched to ${isDark ? 'light' : 'dark'} mode`);
}

function openModal(modal) {
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
  modal.classList.remove('active');
  document.body.style.overflow = '';
}

function updateStatsModal() {
  const totalTransactions = transactions.length;
  const incomeTransactions = transactions.filter(t => t.amount > 0);
  const expenseTransactions = transactions.filter(t => t.amount < 0);
  
  const avgIncome = incomeTransactions.length > 0
    ? incomeTransactions.reduce((acc, t) => acc + t.amount, 0) / incomeTransactions.length
    : 0;
  
  const avgExpense = expenseTransactions.length > 0
    ? Math.abs(expenseTransactions.reduce((acc, t) => acc + t.amount, 0) / expenseTransactions.length)
    : 0;
  
  const biggestExpense = expenseTransactions.length > 0
    ? Math.abs(expenseTransactions.reduce((max, t) => Math.max(max, t.amount), 0))
    : 0;
  
  document.getElementById('stat-total-transactions').textContent = totalTransactions;
  document.getElementById('stat-avg-income').textContent = formatMoney(avgIncome);
  document.getElementById('stat-avg-expense').textContent = formatMoney(avgExpense);
  document.getElementById('stat-biggest-expense').textContent = formatMoney(biggestExpense);
  
  const expensesByCategory = {};
  transactions.filter(t => t.amount < 0).forEach(t => {
    expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + Math.abs(t.amount);
  });
  
  const totalExpenses = Object.values(expensesByCategory).reduce((a, b) => a + b, 0);
  
  categoryBreakdownEl.innerHTML = '';
  Object.entries(expensesByCategory)
    .sort(([, a], [, b]) => b - a)
    .forEach(([category, amount]) => {
      const catData = categories[category] || categories.other;
      const percent = totalExpenses > 0 ? (amount / totalExpenses * 100) : 0;
      
      const item = document.createElement('div');
      item.className = 'category-item';
      item.innerHTML = `
        <div class="category-item-icon" style="background: linear-gradient(135deg, ${catData.color} 0%, ${catData.color}cc 100%); color: white;">
          <i class="fas ${catData.icon}"></i>
        </div>
        <div class="category-item-info">
          <div class="category-item-name">${catData.name}</div>
          <div class="category-item-amount">${formatMoney(amount)}</div>
        </div>
        <div class="category-item-percent">${percent.toFixed(1)}%</div>
      `;
      categoryBreakdownEl.appendChild(item);
    });
}

function updateCategoryLimits() {
  categoryLimitsContainer.innerHTML = '';
  
  Object.entries(categories).forEach(([key, value]) => {
    const limit = settings.categoryLimits[key] || '';
    const item = document.createElement('div');
    item.className = 'limit-item';
    item.innerHTML = `
      <div class="category-item-icon" style="background: linear-gradient(135deg, ${value.color} 0%, ${value.color}cc 100%); color: white; width: 36px; height: 36px; font-size: 0.75rem;">
        <i class="fas ${value.icon}"></i>
      </div>
      <span style="font-weight: 500; min-width: 100px;">${value.name}</span>
      <input type="number" placeholder="Limit" value="${limit}" data-category="${key}" onchange="updateCategoryLimit('${key}', this.value)" />
    `;
    categoryLimitsContainer.appendChild(item);
  });
}

function updateCategoryLimit(category, value) {
  if (value === '') {
    delete settings.categoryLimits[category];
  } else {
    settings.categoryLimits[category] = parseFloat(value);
  }
  updateLocalStorage();
  showToast('Limit updated');
}

function calculateDeposit() {
  const amount = parseFloat(depositAmountInput.value) || 0;
  const months = parseInt(depositTermSelect.value) || 12;
  
  let rate = 0;
  if (amount >= 10000) rate = 10;
  else if (amount >= 5000) rate = 7;
  else if (amount >= 1000) rate = 5;
  
  const monthlyRate = rate / 100 / 12;
  const monthlyIncome = amount * monthlyRate;
  const totalReturn = amount * Math.pow(1 + monthlyRate, months);
  
  interestRateEl.textContent = `${rate}% APY`;
  monthlyIncomeEl.textContent = formatMoney(monthlyIncome);
  totalReturnEl.textContent = formatMoney(totalReturn);
}

function exportToCSV() {
  if (transactions.length === 0) {
    showToast('No transactions to export', true);
    return;
  }
  
  const headers = ['ID', 'Date', 'Description', 'Category', 'Amount', 'Type'];
  const rows = transactions.map(t => [
    t.id,
    t.date,
    `"${t.text.replace(/"/g, '""')}"`,
    t.category,
    t.amount.toFixed(2),
    t.amount > 0 ? 'income' : 'expense'
  ]);
  
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  
  showToast('Transactions exported successfully!');
}

function clearAllData() {
  if (confirm('Are you sure you want to delete all transactions? This cannot be undone.')) {
    transactions = [];
    updateLocalStorage();
    init();
    showToast('All data cleared');
  }
}

form.addEventListener('submit', addTransaction);
themeToggle.addEventListener('click', toggleTheme);
statsBtn.addEventListener('click', () => openModal(statsModal));
settingsBtn.addEventListener('click', () => openModal(settingsModal));
statsModalClose.addEventListener('click', () => closeModal(statsModal));
settingsModalClose.addEventListener('click', () => closeModal(settingsModal));
statsModal.addEventListener('click', (e) => {
  if (e.target === statsModal) closeModal(statsModal);
});
settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) closeModal(settingsModal);
});
exportBtn.addEventListener('click', exportToCSV);
clearAllBtn.addEventListener('click', clearAllData);
filterCategory.addEventListener('change', init);
filterPeriod.addEventListener('change', init);
depositAmountInput.addEventListener('input', calculateDeposit);
depositTermSelect.addEventListener('change', calculateDeposit);

init();
