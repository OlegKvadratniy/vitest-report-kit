# 🧪 Auto Test Runner & Report Generator

Фреймворк для автоматического запуска тестов и генерации HTML-отчётов с интеграцией Jira.

## 🚀 Быстрый старт

```bash
# Запустить все тесты и открыть отчёт
npm test

# Запустить с подробным выводом
npm run test:verbose
```

## 📁 Структура проекта

```
project/
├── framework/              # Фреймворк (автономный)
│   ├── cli.js              # CLI entry point
│   ├── test-runner.js      # Автозапуск тестов
│   └── report-generator.js # Генератор отчётов
├── example-tests/          # Примеры тестов
│   └── formatMoney.test.js
├── example-app/            # Пример веб-приложения
│   ├── index.html
│   ├── script.js
│   └── style.css
├── _test_report/           # Сгенерированные отчёты
│   └── test-report.html
├── test-report.html        # Standalone отчёт (корень)
├── package.json
└── README.md
```

## ✨ Возможности

### 🔍 Авто-обнаружение тестов
- **Vitest** (по умолчанию)
- **Jest**
- **Mocha**
- Любые файлы по паттернам: `*.test.js`, `*.spec.js`, `tests/**/*.js`, `example-tests/**/*.js`

### 📊 HTML-отчёт с фильтрами
- **Текстовый поиск** по названию теста
- **Фильтр по статусу** (Passed/Failed/Skipped)
- Мгновенная фильтрация (<10ms)
- Pie-диаграмма результатов
- Метрики и статистика
- Современный дизайн с градиентами и тенями

### 🎯 Copy for Jira
- Кнопка "Copy for Jira" для каждого упавшего теста
- Форматирование в Markdown для Jira Cloud/Data Center
- Включает: Environment, Preconditions, Steps to Reproduce, Expected/Actual Result, Stack Trace
- Автоматическое извлечение input/expected/actual из ошибки
- Визуальный фидбек с анимацией: "Copy" → "✅ Copied!" (2 сек) → "Copy"
- Fallback для `file://` (alert + ручное копирование)
- Без эмодзи в копируемом тексте

### 🏷️ Метаданные окружения
- Git branch
- Git commit hash
- Node.js версия
- Платформа (OS)
- Timestamp

## 📝 Использование

### CLI команды

```bash
node framework/cli.js           # Запустить тесты и отчёт
node framework/cli.js --help    # Показать справку
node framework/cli.js --verbose # Подробный вывод
```

### npm скрипты

```bash
npm test           # Основной скрипт
npm run test:verbose  # С подробным выводом
```

## 🔧 Конфигурация

### Паттерны поиска тестов

В `framework/test-runner.js` можно изменить `config.testPatterns`:

```javascript
const config = {
  testPatterns: [
    '**/*.test.js',
    '**/*.test.mjs',
    '**/*.spec.js',
    '**/*.spec.mjs',
    '**/tests/**/*.js',
    '**/tests/**/*.mjs',
    '**/example-tests/**/*.js'
  ],
  excludePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.git/**',
    '**/vendor/**'
  ]
};
```

### Поддерживаемые фреймворки

Фреймворк автоматически определяет установленный тест-раннер:

```javascript
const frameworks = {
  vitest: {
    detect: 'vitest',
    command: 'npx vitest run --reporter=json --outputFile={output}'
  },
  jest: {
    detect: 'jest',
    command: 'npx jest --json --outputFile={output}'
  },
  mocha: {
    detect: 'mocha',
    command: 'npx mocha --reporter=json --reporter-option output={output}'
  }
};
```

## 📋 Формат отчёта

### Пример Jira Markdown

```markdown
# Test Failure: работает с нулём

## Environment
| Field | Value |
|-------|-------|
| **Branch** | main |
| **Commit** | abc1234 |
| **Node** | v25.9.0 |
| **Platform** | linux |
| **Timestamp** | 2026-04-26T21:14:21.637Z |
| **Test File** | formatMoney.test.js |
| **Duration** | 13.54ms |

## Preconditions
- Function: `formatMoney`
- Test case: `работает с нулём`

## Steps to Reproduce
1. Open test file: `formatMoney.test.js`
2. Find test: `работает с нулём`
3. Pass input value: `0` to function `formatMoney`
4. Execute: `formatMoney(0)`
5. Observe the result

## Expected Result
Function should return: `$1.00`

## Actual Result
Function returned: `$0.00`

## Error Details
Assertion failed: `AssertionError: expected '$0.00' to be '$1.00' // Object.is equality`

## Stack Trace
```
AssertionError: expected '$0.00' to be '$1.00' // Object.is equality
    at /home/went/VSCode/JSTrainee/example-tests/formatMoney.test.js:20:28
```
```

## 🧪 Пример теста

```javascript
// example-tests/formatMoney.test.js
import { describe, it, expect } from 'vitest';

const formatMoney = (amount) => `$${amount.toFixed(2)}`;

describe('formatMoney', () => {
  it('форматирует целое число', () => {
    expect(formatMoney(10)).toBe('$10.00');
  });

  it('работает с нулём', () => {
    expect(formatMoney(0)).toBe('$0.00');
  });
});
```

## 🎯 Критерии приёмки

- ✅ Кнопка копирует валидный Markdown
- ✅ Фильтры работают без перезагрузки
- ✅ Отчёт весит <50KB (20KB)
- ✅ Рендерится <200ms (~50ms)
- ✅ Работает через `file://` и `http://`
- ✅ Нулевые внешние зависимости в отчёте
- ✅ Авто-обнаружение тест-фреймворка
- ✅ Отчёт открывается в браузере автоматически
- ✅ Улучшенная вёрстка с градиентами и тенями

## 📊 Производительность

| Метрика | Значение |
|---------|----------|
| Размер отчёта | ~20KB |
| Время рендера | <50ms |
| Время фильтрации | <10ms |
| Время запуска | ~2s (включая тесты) |

## 🔐 Безопасность

- Экранирование HTML в отчётах (XSS защита)
- Экранирование Markdown спецсимволов
- Нет внешних зависимостей в отчёте
- Работает офлайн

## 📝 Changelog

### v1.1.0
- ✅ Улучшена вёрстка отчёта (градиенты, тени, border-radius)
- ✅ Файл отчёта переименован в `test-report.html`
- ✅ Разделение фреймворка и тестов по разным директориям
- ✅ Автоматическое извлечение input/expected/actual из ошибки
- ✅ Убраны эмодзи из копируемого Markdown
- ✅ Улучшена структура Steps to Reproduce

### v1