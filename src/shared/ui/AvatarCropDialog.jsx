import React, { useEffect, useId, useRef } from "react";
import { AVATAR_OUTPUT_SIZE } from "../../features/auth/avatar-crop.js";
import { useDialogFocusTrap } from "./useDialogFocusTrap.js";

export function AvatarCropDialog({ image, onCancel, onConfirm, busy, error }) {
  const titleId = useId();
  const containerRef = useRef(null);
  const confirmRef = useRef(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useDialogFocusTrap({ active: true, containerRef, initialFocusRef: confirmRef });

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onCancelRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="avatar-crop-backdrop">
      <div
        ref={containerRef}
        className="avatar-crop"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <h2 id={titleId}>Recortar foto</h2>
        <div className="avatar-crop__preview" style={{ width: AVATAR_OUTPUT_SIZE, height: AVATAR_OUTPUT_SIZE }}>
          <img src={image.src} alt="" />
        </div>
        {error ? <p className="form-alert" role="alert">{error}</p> : null}
        <div className="avatar-crop__actions">
          <button className="ghost" type="button" onClick={onCancel} disabled={busy}>Cancelar</button>
          <button ref={confirmRef} className="primary small" type="button" onClick={onConfirm} disabled={busy}>
            {busy ? "Salvando…" : "Usar foto"}
          </button>
        </div>
      </div>
    </div>
  );
}
