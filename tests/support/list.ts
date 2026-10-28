import type { Page } from '@playwright/test';

export const TOTAL = 8000;

// The transaction rows are plain <div>s with no list or table semantics, so
// there is no role to query them by. CSS is the only handle for now; giving
// the list real semantics is part of the accessibility session (B3), and these
// locators should move to getByRole when it does.
export const rows = (page: Page) => page.locator('.transaction-row');
export const table = (page: Page) => page.locator('.transactions-table');

// The input has no <label>; its accessible name comes from the placeholder,
// which is a fallback rather than a label. Flagged for B3.
export const search = (page: Page) =>
  page.getByRole('textbox', { name: /search merchant, category, or notes/i });

// Matches "8000 transactions", "1 transaction", "0 transactions".
export const resultCount = (page: Page) => page.getByText(/^\d+ transactions?$/);

export async function countShown(page: Page) {
  const text = await resultCount(page).textContent();
  return Number(text?.match(/^(\d+)/)?.[1]);
}

/** "$1,234.56" -> 1234.56 */
export const parseAmount = (text: string) => Number(text.replace(/[^0-9.]/g, ''));
