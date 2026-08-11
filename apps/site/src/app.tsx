import { createBrowserRouter, RouterProvider } from "react-router-dom";

import { LandingPage } from "@/pages/landing";
import { PlaygroundPage } from "@/pages/playground";

/**
 * Derive the Router basename from the Vite asset base so the two can never
 * drift (GitHub Pages serves the site under `/<repo>/`). Root deployments
 * yield an empty basename.
 */
function deriveBasename(): string {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/+$/, "");
  return base;
}

const router = createBrowserRouter(
  [
    { path: "/", element: <LandingPage /> },
    { path: "/playground", element: <PlaygroundPage /> },
  ],
  { basename: deriveBasename() }
);

export function App() {
  return <RouterProvider router={router} />;
}
