export function Header() {
  return (
    <header className="hero">
      {/*
        This banner is almost always the LCP element on this page.
        Look closely at how it's requested and sized.
      */}
      <img
        className="hero-image"
        src="https://picsum.photos/id/1080/2000/1200"
        loading="lazy"
        alt="Dashboard overview"
      />
      <div className="hero-copy">
        <h1>Ledger</h1>
        <p>Your spending, all in one place.</p>
      </div>
    </header>
  );
}
