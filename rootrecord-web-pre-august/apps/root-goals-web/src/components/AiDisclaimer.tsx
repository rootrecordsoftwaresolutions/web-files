import { AI_DISCLAIMER } from "../lib/constants";

export function AiDisclaimer({ compact }: { compact?: boolean }) {
  return (
    <p className={`ai-disclaimer${compact ? " ai-disclaimer--compact" : ""}`} role="note">
      {AI_DISCLAIMER}
    </p>
  );
}
