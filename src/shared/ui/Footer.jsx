import React from "react";
import { Link } from "react-router-dom";

export function Footer() {
  return <footer><div className="shell footer-inner"><Link className="brand" to="/"><span className="brand-mark"><img src="/favicon.svg" alt="" /></span><span className="brand-name">GDG <span className="brand-accent">Jobs</span></span></Link><span>Feito com a comunidade GDG · 2026</span></div></footer>;
}
