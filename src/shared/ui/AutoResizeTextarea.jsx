import React, { useCallback, useEffect, useRef } from "react";

export const TEXTAREA_LIMITS = {
  profileBio: 500,
  jobDescription: 4000,
  curationComment: 1000,
};

export function resizeTextarea(element) {
  if (!element) return;
  const maxHeight = Number.parseInt(element.dataset.maxHeightPx ?? "", 10);
  element.style.height = "0px";
  const scrollHeight = element.scrollHeight;
  if (Number.isFinite(maxHeight) && maxHeight > 0) {
    element.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    element.style.overflowY = scrollHeight > maxHeight ? "auto" : "hidden";
    return;
  }
  element.style.height = `${scrollHeight}px`;
  element.style.overflowY = "hidden";
}

export function AutoResizeTextarea({
  id,
  name,
  value,
  onChange,
  maxLength,
  rows = 3,
  maxHeightPx,
  showCount = true,
  className = "",
  ...rest
}) {
  const ref = useRef(null);
  const count = value?.length ?? 0;
  const atLimit = maxLength != null && count >= maxLength;
  const countId = id && showCount && maxLength != null ? `${id}-count` : undefined;

  const syncHeight = useCallback(() => {
    resizeTextarea(ref.current);
  }, []);

  useEffect(() => {
    syncHeight();
  }, [value, syncHeight]);

  const handleChange = (event) => {
    onChange?.(event);
    resizeTextarea(event.target);
  };

  return (
    <>
      <textarea
        ref={ref}
        id={id}
        name={name}
        value={value}
        onChange={handleChange}
        rows={rows}
        maxLength={maxLength}
        className={`auto-resize-textarea${className ? ` ${className}` : ""}`}
        data-max-height-px={maxHeightPx}
        aria-describedby={countId}
        {...rest}
      />
      {countId ? (
        <span
          id={countId}
          className={`field-char-count${atLimit ? " field-char-count--limit" : ""}`}
          aria-live="polite"
        >
          {count}/{maxLength}
        </span>
      ) : null}
    </>
  );
}
