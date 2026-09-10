import { useState } from "react";
import {
  MERCHANT_COUNTS,
  TRANSACTIONS,
  type Transaction,
} from "../data/transactions";

function filterAndSort(query: string): Transaction[] {
  const q = query.trim().toLowerCase();

  const filtered = q
    ? TRANSACTIONS.filter(
        (t) =>
          t.merchant.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          t.notes.toLowerCase().includes(q),
      )
    : TRANSACTIONS;

  // Sorting a copy on every call, on the full result set, on every keystroke.
  return [...filtered].sort((a, b) => b.amount - a.amount);
}

export function TransactionList() {
  const [query, setQuery] = useState("");

  // No debounce, no useMemo: this whole pipeline
  // filter → sort → render every row, synchronously on every keystroke
  const results = filterAndSort(query);

  return (
    <section className="transactions">
      <div className="transactions-toolbar">
        <input
          type="text"
          placeholder="Search merchant, category, or notes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span>{results.length} transactions</span>
      </div>

      {/* Every matching row is mounted as a real DOM node — no
          windowing/virtualization, even though this list can be thousands
          of rows long. */}
      <div className="transactions-table">
        {results.map((t) => {
          return (
            <div className="transaction-row" key={t.id}>
              <span className="col-date">{t.date}</span>
              <span className="col-merchant">{t.merchant}</span>
              <span className="col-category">{t.category}</span>
              <span className="col-notes">{t.notes}</span>
              <span className="col-risk">
                seen ×{MERCHANT_COUNTS.get(t.merchant) ?? 0}
              </span>
              <span className="col-amount">
                {t.amount.toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                })}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
