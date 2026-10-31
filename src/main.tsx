import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { IconMotion } from "./IconMotion";
import "./styles.css";
import "./appearance.css";
import "./team.css";
import "./icon-motion.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <IconMotion />
    <App />
  </React.StrictMode>,
);
