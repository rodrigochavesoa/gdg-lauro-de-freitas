import React, { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { applyTheme, initTheme, subscribeTheme } from "./theme.js";

const OPTIONS = [
  { value: "light", label: "Claro", Icon: Sun },
  { value: "dark", label: "Escuro", Icon: Moon },
  { value: "system", label: "Sistema", Icon: Monitor },
];

export function ThemeToggle({ className = "" }) {
  const [theme, setTheme] = useState(initTheme);

  useEffect(() => subscribeTheme(setTheme), []);

  const select = (value) => {
    setTheme(applyTheme(value, { persist: true }));
  };

  return (
    <div className={["theme-toggle", className].filter(Boolean).join(" ")} role="group" aria-label="Tema da interface">
      {OPTIONS.map((option) => {
        const IconGlyph = option.Icon;
        return (
          <button
            key={option.value}
            type="button"
            className="theme-toggle-btn"
            aria-label={option.label}
            aria-pressed={theme === option.value}
            onClick={() => select(option.value)}
          >
            <IconGlyph size={16} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
