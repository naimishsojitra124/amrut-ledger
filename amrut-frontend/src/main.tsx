import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { AppProvider } from "./providers/app-provider.tsx";
import { SidebarProvider } from "./providers/sidebar-provider.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProvider>
      <SidebarProvider>
        <App />
      </SidebarProvider>
    </AppProvider>
  </StrictMode>,
);
