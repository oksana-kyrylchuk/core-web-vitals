import { useEffect, useState } from "react";

// Simulates a common real-world pattern: a promo/upsell banner that arrives
// from a "personalization" call after the page has already rendered, and
// gets inserted above content that's already on screen.
export function PromoBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 1800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="promo-banner-container">
      {
        visible ? (
            <div className="promo-banner">
              Go Premium: automatic categorization + unlimited accounts.{" "}
              <button>Upgrade</button>
            </div>
        ) : null
      }
    </div>
  );
}
