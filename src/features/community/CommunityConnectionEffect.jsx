import React from "react";

const COMMUNITY_CONNECTION_PATH = "M-8 52 C 180 118 380 14 560 64 C 740 112 920 8 1100 58 C 1240 96 1360 22 1448 48";

function MovingPacket({ reverse = false, delay = "0s" }) {
  const start = 0;
  const end = 1;

  return (
    <g className="community-connection-packet">
      <animateMotion
        dur="4.8s"
        begin={delay}
        repeatCount="indefinite"
        path={COMMUNITY_CONNECTION_PATH}
        calcMode="linear"
        rotate="auto"
        keyPoints={reverse ? `${end};${start};${start}` : `${start};${end};${end}`}
        keyTimes="0;0.8;1"
      />
      <animate
        attributeName="opacity"
        values="0;1;1;0;0"
        keyTimes="0;0.08;0.72;0.8;1"
        dur="4.8s"
        repeatCount="indefinite"
      />
      <rect x="-30" y="-1.25" width="30" height="2.5" rx="1.25" fill="url(#community-connection-tail)" />
      <circle r="8" fill="#438dff" opacity=".34" />
      <circle r="3" fill="#fff" opacity=".92" />
    </g>
  );
}

export function CommunityConnectionEffect() {
  return (
    <g className="community-connection-effect" aria-hidden="true">
      <defs>
        <linearGradient id="community-connection-tail" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#60a5fa" stopOpacity="0" />
          <stop offset="1" stopColor="#60a5fa" stopOpacity=".48" />
        </linearGradient>
      </defs>
      <path className="community-connection-wave-line" d={COMMUNITY_CONNECTION_PATH} />
      <MovingPacket />
      <MovingPacket reverse delay="-1.9s" />
    </g>
  );
}
