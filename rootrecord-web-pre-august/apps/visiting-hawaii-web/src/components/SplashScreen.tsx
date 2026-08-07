import { useState } from "react";

export function SplashScreen({ onContinue }: { onContinue: () => void }) {
  const [show, setShow] = useState(true);

  if (!show) return null;

  return (
    <div className="splash">
      <img src="/favicon.svg" alt="" className="splash__logo" width={88} height={88} />
      <h1>Visiting Hawaiʻi</h1>
      <p>
        Authentic, offline-first island guides rooted in mālama ʻāina — care for the land. Built by RootRecord.
      </p>
      <button
        type="button"
        className="btn btn--sunset"
        onClick={() => {
          setShow(false);
          onContinue();
        }}
      >
        Begin your journey
      </button>
    </div>
  );
}
