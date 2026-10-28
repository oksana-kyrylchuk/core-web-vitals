import type { Page } from '@playwright/test';

export const TOTAL = 8000;

// Everything here is found the way assistive technology finds it: by role and
// accessible name. Before the accessibility pass the rows were bare <div>s and
// the search box was named only by its placeholder, so these had to be CSS.
export const table = (page: Page) => page.getByRole('table', { name: 'Transactions' });

/** Data rows only; the header row has column headers, not cells. */
export const rows = (page: Page) =>
  table(page).getByRole('row').filter({ has: page.getByRole('cell') });

export const search = (page: Page) => page.getByRole('textbox', { name: 'Search transactions' });

/** "8000 transactions", "1 transaction" — announced through a status region. */
export const resultCount = (page: Page) => page.getByRole('status');

export async function countShown(page: Page) {
  const text = await resultCount(page).textContent();
  return Number(text?.match(/(\d+)/)?.[1]);
}

/** "$1,234.56" -> 1234.56 */
export const parseAmount = (text: string) => Number(text.replace(/[^0-9.]/g, ''));
