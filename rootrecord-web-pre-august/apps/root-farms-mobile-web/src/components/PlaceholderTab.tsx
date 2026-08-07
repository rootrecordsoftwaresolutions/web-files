export function PlaceholderTab({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div className="screen placeholder-screen">
      <h1>{title}</h1>
      <p>{blurb}</p>
      <p className="placeholder-soon">Coming soon</p>
    </div>
  );
}
