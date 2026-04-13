import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import "./design-system/tokens.css";
import "./design-system/typography.css";
import "./design-system/skins.css";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

