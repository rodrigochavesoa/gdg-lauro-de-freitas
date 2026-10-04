import React, { useEffect } from "react";

function prefetchFamilyForPath(pathname) {
  if (pathname === "/vagas" || /^\/jobs\/[^/]+\/?$/.test(pathname)) return "jobs";
  if (pathname === "/minhas-candidaturas") return "applications";
  if (pathname === "/preferencias") return "privacy";
  return null;
}

export function PrefetchIntentProvider({ children, jobs, applications, privacy }) {
  useEffect(() => {
    const onIntent = (event) => {
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!target || target.getAttribute("aria-disabled") === "true") return;

      let url;
      try {
        url = new URL(target.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;

      const family = prefetchFamilyForPath(url.pathname);
      if (family === "jobs") jobs?.();
      if (family === "applications") applications?.();
      if (family === "privacy") privacy?.();
    };

    document.addEventListener("pointerover", onIntent);
    document.addEventListener("focusin", onIntent);
    return () => {
      document.removeEventListener("pointerover", onIntent);
      document.removeEventListener("focusin", onIntent);
    };
  }, [applications, jobs, privacy]);

  return <>{children}</>;
}
