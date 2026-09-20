import React from "react";

/** DS-07 — mesma onda inferior de Login/Home (`fill: var(--color-surface)`). */
export function AdminSurfaceCurve() {
  return (
    <svg className="login-panel__curve login-panel__curve--bottom" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path fill="var(--color-surface)" stroke="none" d="M-8 52 C 180 118 380 14 560 64 C 740 112 920 8 1100 58 C 1240 96 1360 22 1448 48 L 1448 128 L -8 128 Z" />
    </svg>
  );
}
