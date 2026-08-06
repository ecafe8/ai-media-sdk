import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "@workspace/ui/components/shadcn/sonner";

import "@workspace/ui/globals.css";
import { App } from "@/app";
import { ThemeProvider } from "@/components/theme-provider";

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <App />
      <Toaster richColors position="top-right" />
    </ThemeProvider>
  </StrictMode>
);
