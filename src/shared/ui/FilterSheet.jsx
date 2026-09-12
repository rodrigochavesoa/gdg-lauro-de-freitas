import React, { useEffect } from "react";

function filterResultsCta(count) {
  return count === 1 ? "Ver 1 resultado" : `Ver ${count} resultados`;
}

export function FilterSheet({ open, onClose, resultCount, titleId, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div className="filters-slot">
      {open ? (
        <button
          type="button"
          className="filters-backdrop"
          aria-label="Fechar filtros"
          onClick={onClose}
        />
      ) : null}
      <aside
        className={open ? "filters open" : "filters"}
        role={open ? "dialog" : undefined}
        aria-modal={open ? "true" : undefined}
        aria-labelledby={titleId}
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
