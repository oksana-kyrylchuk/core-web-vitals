import { useDeferredValue, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
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

  // Sorting a copy on every call, on the full result set, on every deferred update.
  return [...filtered].sort((a, b) => b.amount - a.amount);
}

export function TransactionList() {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const filteredItems = useMemo(
    () => filterAndSort(deferredQuery),
    [deferredQuery],
  );
  const tableRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredItems.length,
    getScrollElement: () => tableRef.current,
    estimateSize: () => 34,
    getItemKey: (index) => filteredItems[index].id,
    overscan: 10,
  });
  return (
    <section className="transactions">
      <div className="transactions-toolbar">
        <input
          type="text"
          placeholder="Search merchant, category, or notes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span>{filteredItems.length} transactions</span>
      </div>

      <div className="transactions-table" ref={tableRef}>
        <div
          className="transactions-table-content"
          style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const t = filteredItems[virtualRow.index];

            return (
              <div
                className="transaction-row"
                key={virtualRow.key}
                data-parity={virtualRow.index % 2}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
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
      </div>
    </section>
  );
}
