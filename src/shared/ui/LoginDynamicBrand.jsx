import React from "react";

export function LoginDynamicBrand() {
  return (
    <svg className="login-dynamic-brand-svg" viewBox="0 0 460 90" aria-hidden="true">
      <defs>
        <style>
          {`
            .brand-gdg { font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif; font-weight: 800; font-size: 38px; }
            .brand-jobs { font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif; font-weight: 700; font-size: 38px; fill: #2563EB; }
            .typing-text { font-family: 'JetBrains Mono', 'Fira Code', 'Inter', monospace; font-weight: 800; font-size: 12px; fill: #16A34A; letter-spacing: 2px; }
            .type-char { opacity: 0; animation: 5s steps(1) infinite; }
            .char-1 { animation-name: typeChar1; }
            .char-2 { animation-name: typeChar2; }
            .char-3 { animation-name: typeChar3; }
            .char-4 { animation-name: typeChar4; }
            .char-5 { animation-name: typeChar5; }
            @keyframes typeChar1 { 0%, 7% { opacity: 0; } 8%, 88% { opacity: 1; } 89%, 100% { opacity: 0; } }
            @keyframes typeChar2 { 0%, 13% { opacity: 0; } 14%, 85% { opacity: 1; } 86%, 100% { opacity: 0; } }
            @keyframes typeChar3 { 0%, 19% { opacity: 0; } 20%, 82% { opacity: 1; } 83%, 100% { opacity: 0; } }
            @keyframes typeChar4 { 0%, 25% { opacity: 0; } 26%, 79% { opacity: 1; } 80%, 100% { opacity: 0; } }
            @keyframes typeChar5 { 0%, 31% { opacity: 0; } 32%, 76% { opacity: 1; } 77%, 100% { opacity: 0; } }
            .typing-cursor { fill: #16A34A; animation: moveCursor 5s steps(1) infinite, blinkCursor 0.65s infinite; }
            @keyframes moveCursor {
              0%, 7% { transform: translateX(0px); }
              8%, 13% { transform: translateX(11px); }
              14%, 19% { transform: translateX(22px); }
              20%, 25% { transform: translateX(33px); }
              26%, 31% { transform: translateX(44px); }
              32%, 76% { transform: translateX(55px); }
              77%, 79% { transform: translateX(44px); }
              80%, 82% { transform: translateX(33px); }
              83%, 85% { transform: translateX(22px); }
              86%, 88% { transform: translateX(11px); }
              89%, 100% { transform: translateX(0px); }
            }
            @keyframes blinkCursor { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
            .status-dot { fill: #16A34A; animation: statusPulse 2s ease-in-out infinite; }
            @keyframes statusPulse {
              0%, 100% { transform: scale(1); opacity: 0.9; }
              50% { transform: scale(1.25); opacity: 1; }
            }
            @media (prefers-reduced-motion: reduce) {
              .type-char { opacity: 1; animation: none; }
              .typing-cursor { display: none; animation: none; }
              .status-dot { animation: none; }
            }
          `}
        </style>
      </defs>
      <g transform="translate(10, 18)">
        <path d="M 40 10 L 14 28" stroke="#EA4335" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 14 28 L 40 46" stroke="#4285F4" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 52 46 L 78 28" stroke="#FBBC04" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 52 10 L 78 28" stroke="#34A853" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g transform="translate(108, 56)">
        <text className="brand-gdg" letterSpacing="-0.5">GDG</text>
        <text x="96" className="brand-jobs" letterSpacing="-0.5">Jobs</text>
      </g>
      <g transform="translate(305, 31)">
        <rect width="112" height="28" rx="14" fill="#F0FDF4" stroke="#DCFCE7" strokeWidth="1.5" />
        <g transform="translate(13, 14)">
          <circle className="status-dot" cx="0" cy="0" r="3.5" />
        </g>
        <g className="typing-text" transform="translate(26, 18)">
          <text x="0" className="type-char char-1">V</text>
          <text x="11" className="type-char char-2">A</text>
          <text x="22" className="type-char char-3">G</text>
          <text x="33" className="type-char char-4">A</text>
          <text x="44" className="type-char char-5">S</text>
          <rect className="typing-cursor" x="1" y="-10" width="2" height="12" rx="1" />
        </g>
      </g>
    </svg>
  );
}
