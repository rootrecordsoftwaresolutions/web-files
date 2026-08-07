import { useAppStore } from "../store/useAppStore";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder = "Search places, tips…" }: Props) {
  const setTab = useAppStore((s) => s.setTab);

  const startVoice = () => {
    type SpeechCtor = new () => {
      lang: string;
      onresult: ((ev: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
      start: () => void;
    };
    const win = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
    const SR = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (!SR) {
      window.alert("Voice search is not supported in this browser.");
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.onresult = (ev) => {
      const text = ev.results[0]?.[0]?.transcript;
      if (text) onChange(text);
    };
    rec.start();
  };

  return (
    <div className="search-bar">
      <span aria-hidden>🔍</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Search"
        onFocus={() => setTab("explore")}
      />
      <button type="button" className="btn btn--ghost" style={{ padding: "0.35rem 0.6rem", fontSize: "0.75rem" }} onClick={startVoice} aria-label="Voice search">
        🎤
      </button>
    </div>
  );
}
