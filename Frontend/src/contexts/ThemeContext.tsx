import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "dark" | "light";

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "dark",
  toggle: () => {},
});

const DARK_VARS: Record<string, string> = {
  "--page-bg":       "#020817",
  "--page-bg-alpha": "rgba(2,8,23,0.6)",
  "--surface":       "rgba(15,23,42,0.7)",
  "--surface-2":     "rgba(12,20,38,0.85)",
  "--nav-bg":        "rgba(2,8,23,0.88)",
  "--tab-bg":        "rgba(2,8,23,0.9)",
  "--border-c":      "rgba(148,163,184,0.08)",
  "--border-mid":    "rgba(148,163,184,0.14)",
  "--text":          "#e2e8f0",
  "--text-dim":      "#64748b",
  "--input-bg":      "rgba(10,18,34,0.9)",
  "--input-bdr":     "rgba(148,163,184,0.14)",
};

const LIGHT_VARS: Record<string, string> = {
  "--page-bg":       "#f1f5f9",
  "--page-bg-alpha": "rgba(241,245,249,0.85)",
  "--surface":       "rgba(255,255,255,0.95)",
  "--surface-2":     "rgba(255,255,255,0.97)",
  "--nav-bg":        "rgba(248,250,252,0.97)",
  "--tab-bg":        "rgba(248,250,252,0.97)",
  "--border-c":      "rgba(0,0,0,0.07)",
  "--border-mid":    "rgba(0,0,0,0.11)",
  "--text":          "#0f172a",
  "--text-dim":      "#475569",
  "--input-bg":      "rgba(255,255,255,0.97)",
  "--input-bdr":     "rgba(0,0,0,0.15)",
};

function applyVars(vars: Record<string, string>) {
  const root = document.documentElement;
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem("chataid-theme") as Theme) || "dark"
  );

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      applyVars(DARK_VARS);
    } else {
      root.classList.remove("dark");
      applyVars(LIGHT_VARS);
    }
    localStorage.setItem("chataid-theme", theme);
  }, [theme]);

  const toggle = () => setTheme(t => (t === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
