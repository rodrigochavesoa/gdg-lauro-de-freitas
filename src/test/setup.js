import "@testing-library/jest-dom/vitest";

if (typeof window.scrollTo !== "function") {
  window.scrollTo = () => {};
}
