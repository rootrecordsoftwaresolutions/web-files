import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { syncNativeAds } from "./lib/nativeAds";
import "./styles.css";

function Root() {
  useEffect(() => {
    syncNativeAds();
  }, []);
  return <App />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
