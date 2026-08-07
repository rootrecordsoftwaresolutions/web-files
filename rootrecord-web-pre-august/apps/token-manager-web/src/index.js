import React from "react";
import ReactDOM from "react-dom/client";
import { Buffer } from "buffer";
import "./index.css";
import App from "./App";

// Solana web3.js + spl-token need Buffer in the browser runtime.
if (typeof window !== "undefined" && !window.Buffer) {
  window.Buffer = Buffer;
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
