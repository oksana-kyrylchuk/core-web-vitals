// Generates a realistic-sized transaction dataset for a personal finance
// dashboard, similar in shape to what the "Ledger" project will deal with.

export type Transaction = {
  id: number;
  date: string;
  merchant: string;
  category: string;
  amount: number;
  notes: string;
};

const MERCHANTS = [
  "Amazon", "Uber", "Netflix", "Spotify", "Lidl", "Biedronka", "Zabka",
  "PKP Intercity", "Orlen", "Allegro", "Rossmann", "Media Markt",
  "IKEA", "Booking.com", "Steam", "Apple", "Google Play", "Żabka",
  "Carrefour", "InPost",
];

const CATEGORIES = [
  "Groceries", "Transport", "Entertainment", "Subscriptions", "Shopping",
  "Bills", "Travel", "Health", "Dining", "Other",
];

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const rand = seededRandom(42);

function generateTransactions(count: number): Transaction[] {
  const out: Transaction[] = [];
  const start = new Date("2025-01-01").getTime();
  const end = new Date("2026-08-22").getTime();

  for (let i = 0; i < count; i++) {
    const date = new Date(start + rand() * (end - start));
    const merchant = MERCHANTS[Math.floor(rand() * MERCHANTS.length)];
    const category = CATEGORIES[Math.floor(rand() * CATEGORIES.length)];
    const amount = Math.round((rand() * 500 + 2) * 100) / 100;

    out.push({
      id: i,
      date: date.toISOString().slice(0, 10),
      merchant,
      category,
      amount,
      notes: `Card ending ${1000 + Math.floor(rand() * 9000)} · auth #${Math.floor(rand() * 999999)}`,
    });
  }

  return out;
}

// 8,000 rows — small for a real backend, plenty to make an unoptimized
// client-side filter/sort visibly janky on every keystroke.
export const TRANSACTIONS: Transaction[] = generateTransactions(8000);

export const MERCHANT_COUNTS = new Map<string, number>();
for (const t of TRANSACTIONS) {
  MERCHANT_COUNTS.set(t.merchant, (MERCHANT_COUNTS.get(t.merchant) ?? 0) + 1);
}
