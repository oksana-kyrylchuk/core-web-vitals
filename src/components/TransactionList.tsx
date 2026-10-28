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

// The header row sits inside the scroll container (position: sticky), so the
// virtual rows start below it.
const HEADER_HEIGHT = 40;

const COLUMNS = [
  { key: "date", label: "Date" },
  { key: "merchant", label: "Merchant" },
  { key: "category", label: "Category" },
  { key: "notes", label: "Notes" },
  { key: "risk", label: "Seen" },
  { key: "amount", label: "Amount" },
] as const;

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
    paddingStart: HEADER_HEIGHT,
    scrollPaddingStart: HEADER_HEIGHT,
  });
  return (
    <section className="transactions" aria-labelledby="transactions-heading">
      <h2 id="transactions-heading" className="visually-hidden">
        Transactions
      </h2>
      <div className="transactions-toolbar">
        <label htmlFor="transaction-search" className="visually-hidden">
          Search transactions
        </label>
        <input
          id="transaction-search"
          type="text"
          placeholder="Search merchant, category, or notes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span role="status">
          {filteredItems.length} {filteredItems.length === 1 ? "transaction" : "transactions"}
        </span>
      </div>

      {/*
        An ARIA table rather than <table>: rows are absolutely positioned
        windows into 8000 items. aria-rowcount and aria-rowindex tell assistive
        technology how big the whole table is and where each rendered row sits.
        tabIndex makes the scroll container reachable by keyboard.
      */}
      <div
        className="transactions-table"
        ref={tableRef}
        role="table"
        aria-labelledby="transactions-heading"
        aria-rowcount={filteredItems.length + 1}
        tabIndex={0}
      >
        <div
          className="transactions-table-content"
          role="presentation"
          style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
        >
          <div className="transaction-row transaction-header" role="row" aria-rowindex={1}>
            {COLUMNS.map((c) => (
              <span
                key={c.key}
                role="columnheader"
                className={`col-${c.key}`}
                aria-sort={c.key === "amount" ? "descending" : undefined}
              >
                {c.label}
              </span>
            ))}
          </div>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const t = filteredItems[virtualRow.index];

            return (
              <div
                className="transaction-row"
                key={virtualRow.key}
                data-parity={virtualRow.index % 2}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                role="row"
                aria-rowindex={virtualRow.index + 2}
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                <span role="cell" className="col-date">{t.date}</span>
                <span role="cell" className="col-merchant">{t.merchant}</span>
                <span role="cell" className="col-category">{t.category}</span>
                <span role="cell" className="col-notes">{t.notes}</span>
                <span role="cell" className="col-risk">
                  seen ×{MERCHANT_COUNTS.get(t.merchant) ?? 0}
                </span>
                <span role="cell" className="col-amount">
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
