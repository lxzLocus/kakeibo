const MONTH_YEAR_KEY = 'kakeibo.monthYear';

export function readMonthYear(): { year: number; month: number } {
  try {
    const raw = localStorage.getItem(MONTH_YEAR_KEY);
    if (raw) {
      const [y, m] = raw.split('-').map(Number);
      if (y > 2000 && y < 2100 && m >= 1 && m <= 12) {
        return { year: y, month: m };
      }
    }
  } catch { /* ignore */ }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function writeMonthYear(year: number, month: number) {
  try {
    localStorage.setItem(MONTH_YEAR_KEY, `${year}-${String(month).padStart(2, '0')}`);
  } catch { /* ignore */ }
}