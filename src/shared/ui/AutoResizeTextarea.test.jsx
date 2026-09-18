import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AutoResizeTextarea, TEXTAREA_LIMITS, resizeTextarea } from "./AutoResizeTextarea.jsx";

describe("AutoResizeTextarea", () => {
  it("bloqueia resize manual e aplica maxLength com contador", () => {
    const onChange = vi.fn();
    render(
      <div className="field-with-counter">
        <label htmlFor="profile-bio">Bio</label>
        <AutoResizeTextarea
          id="profile-bio"
          name="bio"
          value="Olá"
          onChange={onChange}
          maxLength={TEXTAREA_LIMITS.profileBio}
          maxHeightPx={200}
        />
      </div>,
    );
    const textarea = screen.getByLabelText("Bio");
    expect(textarea).toHaveClass("auto-resize-textarea");
    expect(textarea).toHaveAttribute("maxlength", String(TEXTAREA_LIMITS.profileBio));
    expect(screen.getByText(`3/${TEXTAREA_LIMITS.profileBio}`)).toBeInTheDocument();
    fireEvent.change(textarea, { target: { value: "x".repeat(TEXTAREA_LIMITS.profileBio) } });
    expect(onChange).toHaveBeenCalled();
  });

  it("ajusta a altura conforme o conteúdo até o teto", () => {
    const element = document.createElement("textarea");
    element.dataset.maxHeightPx = "120";
    Object.defineProperty(element, "scrollHeight", {
      configurable: true,
      get: () => 240,
    });
    resizeTextarea(element);
    expect(element.style.height).toBe("120px");
    expect(element.style.overflowY).toBe("auto");
  });
});
