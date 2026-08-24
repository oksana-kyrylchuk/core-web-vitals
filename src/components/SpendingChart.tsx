import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { TRANSACTIONS } from "../data/transactions";

// This chart lives at the bottom of the page, behind zero interaction —
// but recharts is imported eagerly at the top of the module graph (see
// App.tsx), so its full weight ships in the initial bundle whether or not
// anyone ever scrolls down to see it.
function buildCategoryTotals() {
  const totals = new Map<string, number>();
  for (const t of TRANSACTIONS) {
    totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount);
  }
  return Array.from(totals, ([category, total]) => ({
    category,
    total: Math.round(total),
  }));
}

export function SpendingChart() {
  const data = buildCategoryTotals();

  return (
    <section className="chart-section">
      <h2>Spending by category</h2>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="category" tick={{ fontSize: 12 }} />
          <YAxis />
          <Tooltip />
          <Bar dataKey="total" fill="#4f7cff" />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}
