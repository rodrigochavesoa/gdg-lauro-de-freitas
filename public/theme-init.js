(function () {
  try {
    var theme = localStorage.getItem("gdgjobs-theme");
    if (theme !== "light" && theme !== "dark" && theme !== "system") theme = "system";
    document.documentElement.setAttribute("data-theme", theme);
  } catch {
    document.documentElement.setAttribute("data-theme", "system");
  }
})();
