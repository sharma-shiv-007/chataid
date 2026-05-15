import { Sun, Moon } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";

export default function ThemeToggle({ size = 15 }: { size?: number }) {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";

  return (
    <button
      onClick={toggle}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 34, height: 34, borderRadius: 8, cursor: "pointer",
        background: dark ? "rgba(148,163,184,0.08)" : "rgba(0,0,0,0.06)",
        border: dark ? "1px solid rgba(148,163,184,0.15)" : "1px solid rgba(0,0,0,0.1)",
        color: dark ? "#94a3b8" : "#475569",
        transition: "all 0.2s",
        flexShrink: 0,
      }}
    >
      {dark ? <Sun size={size} /> : <Moon size={size} />}
    </button>
  );
}
