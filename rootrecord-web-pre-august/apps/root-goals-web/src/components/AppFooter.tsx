import { APP_RELEASE, APP_VERSION } from "../lib/constants";

export function AppFooter() {
  return (
    <p className="footer-credit">
      Root Goals {APP_VERSION} · Release {APP_RELEASE} ·{" "}
      <a href="https://rootrecord.info" target="_blank" rel="noopener noreferrer">
        Root Record
      </a>
    </p>
  );
}
