import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { AppProvider } from "./providers/app-provider.tsx";
import { SidebarProvider } from "./providers/sidebar-provider.tsx";
import { listenForStaleChunks } from "./lib/stale-deploy.ts";

// A tab left open across a deploy still asks for the previous build's chunks.
listenForStaleChunks();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProvider>
      <SidebarProvider>
        <App />
      </SidebarProvider>
    </AppProvider>
  </StrictMode>,
);
