import React, { useRef, useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle.jsx";

const STAFF_ROLES = ["admin", "curator", "moderator"];

function initialsFrom(name) {
  const parts = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "GD";
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function isStaffRole(role) {
  return STAFF_ROLES.includes(role);
}

export function Header({ logged, displayName, role, onSignOut }) {
  const { pathname } = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const closeMobileMenu = () => { menuButtonRef.current?.focus(); setMobileMenuOpen(false); };
  const signOut = async () => {
    await onSignOut?.();
    closeMobileMenu();
  };

  const staff = Boolean(logged && isStaffRole(role));
  const candidate = Boolean(logged && !staff);
  const showAuthCta = !logged && pathname !== "/login" && pathname !== "/admin";

  const navLinks = (onNavigate) => (
    <>
      <NavLink end to="/vagas" onClick={onNavigate}>Vagas</NavLink>
      <NavLink to="/eventos" onClick={onNavigate}>Eventos</NavLink>
      <NavLink end to="/newsletter" onClick={onNavigate}>Newsletter</NavLink>
      {candidate ? <NavLink to="/minhas-candidaturas" onClick={onNavigate}>Minhas candidaturas</NavLink> : null}
      {staff || !logged ? (
        <NavLink to="/admin" onClick={onNavigate}>Área admin</NavLink>
      ) : null}
    </>
  );

  return (
    <header className="topbar">
      <div className="shell nav">
        <Link className="brand" to="/" aria-label="Ir para a página inicial">
          <span className="brand-mark"><img src="/favicon.svg" alt="" /></span>
          <span className="brand-name">GDG <span className="brand-accent">Jobs</span></span>
        </Link>
        <nav>
          {navLinks()}
        </nav>
        <div className="nav-actions">
          <ThemeToggle className="hide-mobile" />
          {logged ? (
            <>
              <button className="icon-button" type="button" aria-label={displayName || "Conta"}>
                <span className="avatar">{initialsFrom(displayName)}</span>
              </button>
              <button className="ghost hide-mobile" type="button" onClick={signOut}>
                <LogOut size={16} /> Sair
              </button>
            </>
          ) : showAuthCta ? (
            <Link className="primary small hide-mobile" to="/login">Entrar ou criar conta</Link>
          ) : (
            /* UX-HEADER-01 / F-022: reserve CTA width on /admin|/login so space-between nav does not shift */
            <span className="primary small hide-mobile nav-actions__spacer" aria-hidden="true">
              Entrar ou criar conta
            </span>
          )}
          <button
            ref={menuButtonRef}
            className="menu"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {mobileMenuOpen && (
        <div id="mobile-navigation" className="mobile-nav open">
          {navLinks(closeMobileMenu)}
          {logged ? (
            <button type="button" onClick={signOut}><LogOut size={17} /> Sair</button>
          ) : showAuthCta ? (
            <NavLink className="primary" to="/login" onClick={closeMobileMenu}>Entrar ou criar conta</NavLink>
          ) : null}
          <ThemeToggle />
        </div>
      )}
    </header>
  );
}
