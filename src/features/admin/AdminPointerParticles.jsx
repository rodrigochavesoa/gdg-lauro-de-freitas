import React, { useEffect, useRef } from "react";

const COLOR_TOKENS = [
  "--color-gdg-blue",
  "--color-gdg-green",
  "--color-gdg-yellow",
  "--color-gdg-red",
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function random(min, max) {
  return min + Math.random() * (max - min);
}

export function AdminPointerParticles({ containerRef }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const root = containerRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return undefined;
    if (typeof ResizeObserver === "undefined") return undefined;

    let context;
    try {
      context = canvas.getContext("2d", { alpha: true });
    } catch {
      return undefined;
    }
    if (!context) return undefined;

    const styles = window.getComputedStyle(root);
    const colors = COLOR_TOKENS.map((token) => styles.getPropertyValue(token).trim()).filter(Boolean);
    if (!colors.length) return undefined;

    const motionPreference = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const coarsePointer = window.matchMedia?.("(pointer: coarse)");
    const field = {
      width: 0,
      height: 0,
      dpr: 1,
      particles: [],
      frame: 0,
      lastFrame: 0,
      pointer: { x: -1000, y: -1000, previousX: -1000, previousY: -1000, velocityX: 0, velocityY: 0, active: false, lastMove: 0 },
    };

    const draw = () => {
      context.clearRect(0, 0, field.width, field.height);
      for (const particle of field.particles) {
        const speed = Math.hypot(particle.vx, particle.vy);
        const angle = speed > 0.12 ? Math.atan2(particle.vy, particle.vx) : particle.angle;
        context.save();
        context.translate(particle.x, particle.y);
        context.rotate(angle);
        context.globalAlpha = Math.min(0.92, particle.alpha + speed * 0.025);
        context.fillStyle = particle.color;
        context.beginPath();
        context.roundRect(-particle.length / 2, -particle.thickness / 2, particle.length, particle.thickness, particle.thickness / 2);
        context.fill();
        context.restore();
      }
    };

    const resize = () => {
      const { width, height } = root.getBoundingClientRect();
      if (!width || !height) return;
      field.width = width;
      field.height = height;
      field.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * field.dpr);
      canvas.height = Math.round(height * field.dpr);
      context.setTransform(field.dpr, 0, 0, field.dpr, 0, 0);
      const count = clamp(Math.round((width * height) / 4000), 88, 320);
      field.particles = Array.from({ length: count }, () => ({
        x: random(5, width - 5),
        y: random(5, height - 5),
        homeX: 0,
        homeY: 0,
        vx: 0,
        vy: 0,
        length: random(2.5, 4.2),
        thickness: random(1.3, 2),
        alpha: random(0.55, 0.86),
        angle: random(-1.2, 1.2),
        color: colors[Math.floor(Math.random() * colors.length)],
      }));
      for (const particle of field.particles) {
        particle.homeX = particle.x;
        particle.homeY = particle.y;
      }
      draw();
    };

    const tick = (now) => {
      field.frame = 0;
      const dt = Math.min(2, Math.max(0.5, (now - (field.lastFrame || now - 16)) / 16));
      field.lastFrame = now;
      const { pointer } = field;
      const idle = now - pointer.lastMove;
      const radius = Math.max(field.width, field.height) * 0.72;
      const speed = clamp(Math.hypot(pointer.velocityX, pointer.velocityY) / 18, 0, 1.6)
        * clamp(1 - idle / 850, 0, 1);
      let energy = 0;

      for (const particle of field.particles) {
        let forceX = 0;
        let forceY = 0;
        if (pointer.active && idle < 1150) {
          const dx = particle.x - pointer.x;
          const dy = particle.y - pointer.y;
          const distance = Math.max(1, Math.hypot(dx, dy));
          const influence = Math.pow(Math.max(0, 1 - distance / radius), 2.2);
          const radial = speed * influence * 1.05;
          const swirl = speed * influence * 0.48;
          const directionX = dx / distance;
          const directionY = dy / distance;
          forceX = (directionX * radial - directionY * swirl) * dt;
          forceY = (directionY * radial + directionX * swirl) * dt;
        }

        particle.vx = (particle.vx + forceX + (particle.homeX - particle.x) * 0.00065 * dt) * Math.pow(0.96, dt);
        particle.vy = (particle.vy + forceY + (particle.homeY - particle.y) * 0.00065 * dt) * Math.pow(0.96, dt);
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        energy += Math.abs(particle.vx) + Math.abs(particle.vy);
      }

      draw();
      if ((pointer.active && idle < 1150) || energy > 0.18) {
        field.frame = window.requestAnimationFrame(tick);
      } else {
        field.lastFrame = 0;
      }
    };

    const onMove = (event) => {
      if (motionPreference?.matches || coarsePointer?.matches) return;
      const bounds = root.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;
      if (!field.pointer.active) {
        field.pointer.previousX = x;
        field.pointer.previousY = y;
      }
      field.pointer.velocityX = clamp(x - field.pointer.previousX, -32, 32);
      field.pointer.velocityY = clamp(y - field.pointer.previousY, -32, 32);
      field.pointer.previousX = x;
      field.pointer.previousY = y;
      field.pointer.x = x;
      field.pointer.y = y;
      field.pointer.active = true;
      field.pointer.lastMove = performance.now();
      if (!field.frame) field.frame = window.requestAnimationFrame(tick);
    };

    const onLeave = () => {
      field.pointer.active = false;
      field.pointer.velocityX = 0;
      field.pointer.velocityY = 0;
      field.pointer.lastMove = performance.now();
      if (!field.frame && !motionPreference?.matches && !coarsePointer?.matches) {
        field.frame = window.requestAnimationFrame(tick);
      }
    };

    root.addEventListener("pointermove", onMove, { passive: true });
    root.addEventListener("pointerleave", onLeave, { passive: true });
    const observer = new ResizeObserver(resize);
    observer.observe(root);
    resize();

    return () => {
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      observer.disconnect();
      if (field.frame) window.cancelAnimationFrame(field.frame);
    };
  }, [containerRef]);

  return <canvas ref={canvasRef} className="admin-pointer-particles" aria-hidden="true" />;
}
