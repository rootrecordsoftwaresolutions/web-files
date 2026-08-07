import { useAppStore } from "../store/useAppStore";

export function ProfileScreen() {
  const darkMode = useAppStore((s) => s.darkMode);
  const largeText = useAppStore((s) => s.largeText);
  const setDarkMode = useAppStore((s) => s.setDarkMode);
  const setLargeText = useAppStore((s) => s.setLargeText);
  const setCulturalTipSeen = useAppStore((s) => s.setCulturalTipSeen);

  return (
    <div className="fade-in">
      <h2 className="section-title">Settings</h2>
      <p className="section-lead">Accessibility and app preferences — all data stays on your device.</p>

      <div className="settings-group">
        <div className="settings-row">
          <span>Dark mode</span>
          <button
            type="button"
            className={`toggle${darkMode ? " toggle--on" : ""}`}
            onClick={() => setDarkMode(!darkMode)}
            aria-pressed={darkMode}
            aria-label="Toggle dark mode"
          />
        </div>
        <div className="settings-row">
          <span>Large text</span>
          <button
            type="button"
            className={`toggle${largeText ? " toggle--on" : ""}`}
            onClick={() => setLargeText(!largeText)}
            aria-pressed={largeText}
            aria-label="Toggle large text"
          />
        </div>
        <div className="settings-row">
          <span>Cultural sensitivity tips</span>
          <button type="button" className="btn btn--ghost" style={{ fontSize: "0.78rem" }} onClick={() => setCulturalTipSeen(false)}>
            Show again
          </button>
        </div>
      </div>

      <div className="settings-group">
        <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem" }}>About</h3>
        <p style={{ margin: 0, fontSize: "0.88rem", lineHeight: 1.55, color: "var(--text-muted)" }}>
          <strong>Visiting Hawaiʻi</strong> is a local-first travel guide emphasizing respectful, sustainable exploration.
          Content is bundled for offline use. Premium maps and community tips coming soon.
        </p>
        <p style={{ margin: "1rem 0 0", fontSize: "0.88rem" }}>
          <a href="https://rootrecord.info/visiting-hawaii-sponsor.html" target="_blank" rel="noopener noreferrer" style={{ color: "var(--sunset)" }}>
            Local business? Sponsored listings →
          </a>
          {" · "}
          <a href="https://rootrecord.info" target="_blank" rel="noopener noreferrer" style={{ color: "var(--sunset)" }}>
            About RootRecord
          </a>
        </p>
      </div>

      <div className="settings-group">
        <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.95rem" }}>Hawaiian glossary</h3>
        <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.85rem", lineHeight: 1.6, color: "var(--text-muted)" }}>
          <li><strong>Aloha</strong> — hello, love, goodbye</li>
          <li><strong>Mahalo</strong> — thank you</li>
          <li><strong>Mālama ʻāina</strong> — care for the land</li>
          <li><strong>Kapu</strong> — sacred / forbidden</li>
          <li><strong>Kūpuna</strong> — elders, ancestors</li>
          <li><strong>Pono</strong> — righteous, balanced</li>
        </ul>
      </div>

      <p className="footer-credit">
        Built by <a href="https://rootrecord.info" target="_blank" rel="noopener noreferrer">RootRecord</a>
        · v0.1.0
      </p>
    </div>
  );
}
