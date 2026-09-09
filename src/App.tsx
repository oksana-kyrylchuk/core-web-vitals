import { lazy, Suspense } from "react";
import { Header } from "./components/Header";
import { PromoBanner } from "./components/PromoBanner";
import { TransactionList } from "./components/TransactionList";
import "./App.css";

const SpendingChart = lazy(() =>
  import("./components/SpendingChart").then(({ SpendingChart: component }) => ({
    default: component,
  })),
);

function ChartFallback() {
  return (
    <section className="chart-section" aria-hidden="true">
      <h2>Spending by category</h2>
      <div className="chart-fallback" />
    </section>
  );
}

function App() {
  return (
    <div className="app">
      <Header />
      <PromoBanner />
      <main>
        <TransactionList />
        <Suspense fallback={<ChartFallback />}>
          <SpendingChart />
        </Suspense>
      </main>
    </div>
  );
}

export default App;
