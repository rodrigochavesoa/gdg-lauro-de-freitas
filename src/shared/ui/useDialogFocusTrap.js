import { useEffect } from "react";

const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function getDialogTabbables(root) {
  if (!root) return [];
  return [...root.querySelectorAll(TABBABLE)].filter((el) => !el.inert && !el.closest("[inert]"));
}

function inertSiblingsOutside(dialogRoot) {
  const marked = [];
  let node = dialogRoot;
  while (node && node !== document.body) {
    const parent = node.parentElement;
    if (!parent) break;
    for (const sibling of parent.children) {
      if (sibling === node || sibling.hasAttribute("inert")) continue;
      sibling.setAttribute("inert", "");
      marked.push(sibling);
    }
    node = parent;
  }
  return () => {
    for (const el of marked) el.removeAttribute("inert");
  };
}

/**
 * Prende Tab no diálogo, marca o fundo com inert e devolve o foco ao fechar.
 * Escape, backdrop e CTA ficam a cargo do componente.
 */
export function useDialogFocusTrap({ active, containerRef, initialFocusRef, inertRootRef }) {
  useEffect(() => {
    if (!active) return undefined;
    const root = containerRef.current;
    if (!root) return undefined;

    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const releaseInert = inertSiblingsOutside(inertRootRef?.current ?? root);
    const focusTarget = initialFocusRef?.current ?? getDialogTabbables(root)[0] ?? root;
    if (typeof focusTarget.focus === "function") focusTarget.focus();

    const onKeyDown = (event) => {
      if (event.key !== "Tab") return;
      const tabbables = getDialogTabbables(root);
      if (tabbables.length === 0) {
        event.preventDefault();
        return;
      }
      const first = tabbables[0];
      const last = tabbables[tabbables.length - 1];
      const activeEl = document.activeElement;
      if (event.shiftKey) {
        if (activeEl === first || !root.contains(activeEl)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }
      if (activeEl === last || !root.contains(activeEl)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      releaseInert();
      if (previous?.isConnected) previous.focus();
    };
  }, [active, containerRef, initialFocusRef, inertRootRef]);
}
