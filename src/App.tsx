import { Header } from "./components/Header";
import { PromoBanner } from "./components/PromoBanner";
import { TransactionList } from "./components/TransactionList";
import { SpendingChart } from "./components/SpendingChart";
import "./App.css";

function App() {
  return (
    <div className="app">
      <Header />
      <PromoBanner />
      <main>
        <TransactionList />
        <SpendingChart />
      </main>
    </div>
  );
}

export default App;
