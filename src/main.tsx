import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import brandLogoUrl from "./assets/brand/niuniu-client-logo.png";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <div className="app-splash" aria-hidden="true">
      <div className="splash-card">
        <div className="niuniu-logo">
          <img alt="" aria-hidden="true" className="splash-logo-image" src={brandLogoUrl} />
        </div>
        <div>
          <b>牛牛开盘</b>
          <span>正在启动复盘工作室</span>
        </div>
        <div className="splash-loader"><i /></div>
      </div>
    </div>
    <App />
  </React.StrictMode>
);
