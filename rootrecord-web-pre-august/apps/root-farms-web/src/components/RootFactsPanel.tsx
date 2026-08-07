import type { PlotCatalogEntry } from "../game/types";

export function RootFactsPanel({ cat }: { cat: PlotCatalogEntry }) {
  return (
    <section className="root-facts" aria-labelledby={`root-facts-${cat.id}`}>
      <p className="root-facts-group">{cat.group}</p>
      <h2 id={`root-facts-${cat.id}`} className="root-facts-sci">
        {cat.scientificName}
      </h2>
      <p className="root-facts-summary">{cat.summary}</p>
      <dl className="root-facts-dl">
        <div>
          <dt>Climate</dt>
          <dd>{cat.climate}</dd>
        </div>
        <div>
          <dt>Growing</dt>
          <dd>{cat.growNotes}</dd>
        </div>
      </dl>
    </section>
  );
}
