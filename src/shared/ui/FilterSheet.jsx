import React, { useEffect, useRef } from "react";
import { useDialogFocusTrap } from "./useDialogFocusTrap.js";

function filterResultsCta(count) {
  return count === 1 ? "Ver 1 resultado" : `Ver ${count} resultados`;
}

export function FilterSheet({ open, onClose, resultCount, titleId, children }) {
  const slotRef = useRef(null);
  const dialogRef = useRef(null);

  useDialogFocusTrap({
    active: open,
    containerRef: dialogRef,
    inertRootRef: slotRef,
  });

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div className="filters-slot" ref={slotRef}>
      {open ? (
        <button
          type="button"
          className="filters-backdrop"
          tabIndex={-1}
          aria-label="Fechar filtros"
          onClick={onClose}
        />
      ) : null}
      <aside
        ref={dialogRef}
        className={open ? "filters open" : "filters"}
        role={open ? "dialog" : undefined}
        aria-modal={open ? "true" : undefined}
        aria-labelledby={titleId}
        tabIndex={open ? -1 : undefined}
      >
        {children}
        <div className="filters__footer">
          <button type="button" className="primary filters__apply" onClick={onClose}>
            {filterResultsCta(resultCount)}
          </button>
        </div>
      </aside>
    </div>
  );
}
