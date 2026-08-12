import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
  useLocation,
  useParams,
} from "react-router-dom";

import { AppProviders } from "@/components/providers";
import "@/lib/i18n";
import {
  DEFAULT_LANG,
  detectInitialLang,
  isSupportedLang,
  storeLang,
} from "@/lib/locale";
import { LandingPage } from "@/pages/landing";
import { PlaygroundPage } from "@/pages/playground";

/**
 * Derive the Router basename from the Vite asset base so the two can never
 * drift (GitHub Pages serves the site under `/<repo>/`). Root deployments
 * yield an empty basename. The language segment lives inside the basename.
 */
function deriveBasename(): string {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/+$/, "");
  return base;
}

/**
 * Root redirect: resolve the visitor language (stored choice > browser
 * language > default) and land on the matching locale landing page.
 */
function RootRedirect() {
  return <Navigate to={`/${detectInitialLang()}`} replace />;
}

/** Compatibility redirect for pre-i18n `/playground` links. */
function LegacyPlaygroundRedirect() {
  return <Navigate to={`/${detectInitialLang()}/playground`} replace />;
}

/**
 * Language layout: validates the `:lang` segment, applies it to i18n, the
 * document language attribute and the page title. Unsupported segments
 * redirect to the default language while keeping the remaining path.
 */
function LangLayout() {
  const params = useParams();
  const location = useLocation();
  const { i18n } = useTranslation();
  const lang = params.lang;
  const valid = isSupportedLang(lang);

  useEffect(() => {
    if (!valid) return;
    void i18n.changeLanguage(lang);
    storeLang(lang);
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }, [valid, lang, i18n]);

  useEffect(() => {
    if (!valid || !lang) return;
    document.title = i18n.t("meta.title", { lng: lang });
  }, [valid, lang, i18n]);

  if (!valid) {
    const rest = location.pathname.slice(`/${lang ?? ""}`.length);
    return <Navigate to={`/${DEFAULT_LANG}${rest}`} replace />;
  }
  return <Outlet />;
}

const router = createBrowserRouter(
  [
    { path: "/", element: <RootRedirect /> },
    { path: "/playground", element: <LegacyPlaygroundRedirect /> },
    {
      path: "/:lang",
      element: <LangLayout />,
      children: [
        { index: true, element: <LandingPage /> },
        { path: "playground", element: <PlaygroundPage /> },
      ],
    },
    { path: "*", element: <RootRedirect /> },
  ],
  { basename: deriveBasename() }
);

export function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
