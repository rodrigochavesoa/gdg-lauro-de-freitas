import React, { useRef, useState } from "react";
import { LogOut, Menu, X } from "lucide-react";

export function Header({ page, setPage, logged, setLogged }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const closeMobileMenu = () => { menuButtonRef.current?.focus(); setMobileMenuOpen(false); };
  const navigateFromMobile = target => { setPage(target); closeMobileMenu(); };
  return <header className="topbar"><div className="shell nav">
    <button className="brand" onClick={() => setPage("home")} aria-label="Ir para a página inicial"><span className="brand-mark"><img src="/favicon.svg" alt="" /></span><span>GDG<span>Jobs</span></span></button>
    <nav><button className={page === "home" ? "active" : ""} onClick={() => setPage("home")}>Vagas</button><button onClick={() => setPage("admin")}>Para empresas</button><button onClick={() => setPage("admin")}>Comunidade</button></nav>
    <div className="nav-actions">{logged ? <><button className="icon-button"><span className="avatar">AM</span></button><button className="ghost hide-mobile" onClick={() => setLogged(false)}><LogOut size={16}/> Sair</button></> : <><button className="ghost hide-mobile" onClick={() => setPage("login")}>Entrar</button><button className="primary small" onClick={() => setPage("login")}>Criar conta</button></>}<button ref={menuButtonRef} className="menu" onClick={() => setMobileMenuOpen(open => !open)} aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={mobileMenuOpen} aria-controls="mobile-navigation">{mobileMenuOpen ? <X size={20}/> : <Menu size={20}/>}</button></div>
  </div>{mobileMenuOpen && <div id="mobile-navigation" className="mobile-nav open"><button className={page === "home" ? "active" : ""} onClick={() => navigateFromMobile("home")}>Vagas</button><button onClick={() => navigateFromMobile("admin")}>Para empresas</button><button onClick={() => navigateFromMobile("admin")}>Comunidade</button>{logged ? <button onClick={() => { setLogged(false); closeMobileMenu(); }}><LogOut size={17}/> Sair</button> : <><button onClick={() => navigateFromMobile("login")}>Entrar</button><button className="primary" onClick={() => navigateFromMobile("login")}>Criar conta</button></>}</div>}</header>;
}
