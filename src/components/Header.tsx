export function Header() {
  return (
    <header className="hero">
    <img
        className="hero-image"
        src="/hero-960.jpg"
        srcSet="/hero-960.jpg 960w, /hero-1920.jpg 1920w"
        sizes="(max-width: 960px) 100vw, 960px"
        width={1920}
        height={1152}
        fetchPriority="high"
        decoding="async"
        alt="Dashboard overview"
    />
      <div className="hero-copy">
        <h1>Ledger</h1>
        <p>Your spending, all in one place.</p>
      </div>
    </header>
  );
}
