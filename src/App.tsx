import { lazy, Suspense, useEffect, useRef, useState } from "react";
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
    <section className="chart-section" aria-busy="true">
      <h2>Spending by category</h2>
      <div className="chart-fallback" />
    </section>
  );
}

function LazySpendingChart() {
  const [shouldLoad, setShouldLoad] = useState(false);
  const chartBoundaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const chartBoundary = chartBoundaryRef.current;
    if (!chartBoundary) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px 0px" },
    );

    observer.observe(chartBoundary);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={chartBoundaryRef}>
      {shouldLoad ? (
        <Suspense fallback={<ChartFallback />}>
          <SpendingChart />
        </Suspense>
      ) : (
        <ChartFallback />
      )}
    </div>
  );
}

function App() {
  return (
    <div className="app">
      <Header />
      <PromoBanner />
      <main>
        <TransactionList />
        <LazySpendingChart />
      </main>
    </div>
  );
}

export default App;
