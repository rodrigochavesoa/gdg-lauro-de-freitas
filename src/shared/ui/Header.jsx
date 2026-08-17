import React, { useRef, useState } from "react";
import { LogOut, Menu, X } from "lucide-react";

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

export function Header({ page, setPage, logged, displayName, onSignOut }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const closeMobileMenu = () => { menuButtonRef.current?.focus(); setMobileMenuOpen(false); };
  const navigateFromMobile = (target) => { setPage(target); closeMobileMenu(); };
  const signOut = async () => {
    await onSignOut?.();
    closeMobileMenu();
  };
  return <header className="topbar"><div className="shell nav">
    <button className="brand" onClick={() => setPage("home")} aria-label="Ir para a página inicial"><span className="brand-mark"><img src="/favicon.svg" alt="" /></span><span>GDG<span>Jobs</span></span></button>
    <nav><button className={page === "home" ? "active" : ""} onClick={() => setPage("home")}>Vagas</button><button onClick={() => setPage("admin")}>Para empresas</button><button onClick={() => setPage("admin")}>Comunidade</button></nav>
    <div className="nav-actions">{logged ? <><button className="icon-button" type="button" aria-label={displayName || "Conta"}><span className="avatar">{initialsFrom(displayName)}</span></button><button className="ghost hide-mobile" type="button" onClick={signOut}><LogOut size={16}/> Sair</button></> : <><button className="ghost hide-mobile" onClick={() => setPage("login")}>Entrar</button><button className="primary small" onClick={() => setPage("login")}>Criar conta</button></>}<button ref={menuButtonRef} className="menu" onClick={() => setMobileMenuOpen(open => !open)} aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={mobileMenuOpen} aria-controls="mobile-navigation">{mobileMenuOpen ? <X size={20}/> : <Menu size={20}/>}</button></div>
  </div>{mobileMenuOpen && <div id="mobile-navigation" className="mobile-nav open"><button className={page === "home" ? "active" : ""} onClick={() => navigateFromMobile("home")}>Vagas</button><button onClick={() => navigateFromMobile("admin")}>Para empresas</button><button onClick={() => navigateFromMobile("admin")}>Comunidade</button>{logged ? <button type="button" onClick={signOut}><LogOut size={17}/> Sair</button> : <><button onClick={() => navigateFromMobile("login")}>Entrar</button><button className="primary" onClick={() => navigateFromMobile("login")}>Criar conta</button></>}</div>}</header>;
}
