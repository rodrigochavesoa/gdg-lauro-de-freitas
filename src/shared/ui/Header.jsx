import React, { useRef, useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { NavLink, Link } from "react-router-dom";

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

export function Header({ logged, displayName, onSignOut }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const closeMobileMenu = () => { menuButtonRef.current?.focus(); setMobileMenuOpen(false); };
  const signOut = async () => {
    await onSignOut?.();
    closeMobileMenu();
  };
  return <header className="topbar"><div className="shell nav">
    <Link className="brand" to="/" aria-label="Ir para a página inicial"><span className="brand-mark"><img src="/favicon.svg" alt="" /></span><span>GDG<span>Jobs</span></span></Link>
    <nav><NavLink end to="/">Vagas</NavLink><NavLink to="/admin">Para empresas</NavLink><NavLink to="/admin">Comunidade</NavLink></nav>
    <div className="nav-actions">{logged ? <><button className="icon-button" type="button" aria-label={displayName || "Conta"}><span className="avatar">{initialsFrom(displayName)}</span></button><button className="ghost hide-mobile" type="button" onClick={signOut}><LogOut size={16}/> Sair</button></> : <><Link className="ghost hide-mobile" to="/login">Entrar</Link><Link className="primary small" to="/login">Criar conta</Link></>}<button ref={menuButtonRef} className="menu" onClick={() => setMobileMenuOpen(open => !open)} aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={mobileMenuOpen} aria-controls="mobile-navigation">{mobileMenuOpen ? <X size={20}/> : <Menu size={20}/>}</button></div>
  </div>{mobileMenuOpen && <div id="mobile-navigation" className="mobile-nav open"><NavLink end to="/" onClick={closeMobileMenu}>Vagas</NavLink><NavLink to="/admin" onClick={closeMobileMenu}>Para empresas</NavLink><NavLink to="/admin" onClick={closeMobileMenu}>Comunidade</NavLink>{logged ? <button type="button" onClick={signOut}><LogOut size={17}/> Sair</button> : <><NavLink to="/login" onClick={closeMobileMenu}>Entrar</NavLink><NavLink className="primary" to="/login" onClick={closeMobileMenu}>Criar conta</NavLink></>}</div>}</header>;
}
