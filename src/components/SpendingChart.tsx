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

// This chart lives at the bottom of the page and is loaded lazily by App.tsx,
// keeping recharts out of the initial bundle.
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

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function SpendingChart() {
  const data = buildCategoryTotals();

  return (
    <section className="chart-section" aria-labelledby="chart-heading">
      <h2 id="chart-heading">Spending by category</h2>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={data}
          title="Spending by category"
          desc="Bar chart of total spending per category, in US dollars. The same figures follow as a table."
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="category" tick={{ fontSize: 12 }} />
          <YAxis />
          <Tooltip />
          <Bar dataKey="total" fill="#4f7cff" />
        </BarChart>
      </ResponsiveContainer>
      {/*
        The bars carry no text a screen reader can use; the table does. The
        class goes on a wrapper: a <table> never gets narrower than its content,
        so width: 1px on the table itself still widened the page.
      */}
      <div className="visually-hidden">
        <table>
          <caption>Total spending by category, in US dollars</caption>
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.map(({ category, total }) => (
              <tr key={category}>
                <th scope="row">{category}</th>
                <td>{currency.format(total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
