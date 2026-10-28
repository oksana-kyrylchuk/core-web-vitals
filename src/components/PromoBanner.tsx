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

  // The banner is in the DOM from the first paint and only becomes visible
  // when the "personalization" arrives, so its slot is exactly as tall as the
  // banner at every width. A fixed min-height could not be: the copy wraps to
  // one, two or three lines (50, 71 and 94 px) depending on the viewport, and
  // the shortfall was the whole remaining CLS. visibility: hidden also keeps
  // the hidden banner out of the accessibility tree and the tab order.
  //
  // This works because the copy is known up front. For content that really
  // arrives late, the slot needs a fixed height with the text clamped to fit.
  return (
    <aside
      className="promo-banner"
      aria-label="Promotion"
      data-visible={visible}
    >
      Go Premium: automatic categorization + unlimited accounts.{" "}
      <button type="button">Upgrade</button>
    </aside>
  );
}
