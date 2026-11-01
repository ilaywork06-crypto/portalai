import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/app/App";
import { installMockApi } from "@/mock/server";
import "@/shared/styles/fonts.css";
import "@/shared/styles/tokens.css";
import "@/shared/styles/app.css";

installMockApi();

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
