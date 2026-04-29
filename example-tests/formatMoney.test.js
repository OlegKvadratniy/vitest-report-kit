import { describe, it, expect } from 'vitest';

const formatMoney = (amount) => `$${amount.toFixed(2)}`;

describe('formatMoney', () => {
  it('форматирует целое число', () => {
    expect(formatMoney(10)).toBe('$10.00');
  });

  it('добавляет ноль после запятой', () => {
    expect(formatMoney(5.5)).toBe('$5.50');
  });

  it('округляет по правилам toFixed', () => {
    expect(formatMoney(1.999)).toBe('$2.00');
  });

  it('работает с нулём', () => {
    expect(formatMoney(0)).toBe('$0.00');
  });

  it('обрабатывает отрицательные числа', () => {
    expect(formatMoney(-42.1)).toBe('$-42.10');
  });
});
