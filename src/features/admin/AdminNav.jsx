import React, { useState } from "react";
import { BriefcaseBusiness, ClipboardCheck, Database, LayoutDashboard, PanelLeftClose, PanelLeftOpen, SquarePlus } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { adminNavItemsForRole, isAdminNavItemActive } from "./admin-nav-items.js";

const ICONS = { panel: LayoutDashboard, curation: ClipboardCheck, jobs: BriefcaseBusiness, publish: SquarePlus, ingest: Database };
const STORAGE_KEY = "gdgjobs-admin-sidebar-collapsed";

function storedCollapsed() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function AdminNav({ profile }) {
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(storedCollapsed);
  const items = adminNavItemsForRole(profile?.role);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // Preferência visual opcional; a navegação funciona sem storage.
    }
  };

  return (
    <aside className={`admin-sidebar${collapsed ? " admin-sidebar--collapsed" : ""}`} aria-label="Navegação administrativa">
      <div className="admin-sidebar__top">
        <Link className="admin-sidebar__brand" to="/" aria-label="GDG Jobs — voltar ao site" title="Voltar ao site">
          <img src="/favicon.svg" alt="" />
          <span className="admin-sidebar__label">GDG <strong>Jobs</strong></span>
        </Link>
        <button
          type="button"
          className="admin-sidebar__toggle"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expandir menu administrativo" : "Recolher menu administrativo"}
          aria-expanded={!collapsed}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? <PanelLeftOpen size={20} aria-hidden="true" /> : <PanelLeftClose size={20} aria-hidden="true" />}
        </button>
      </div>
      <nav className="admin-tabs admin-sidebar__nav" aria-label="Seções da área administrativa">
        {items.map((item) => {
          const Icon = ICONS[item.id];
          const active = isAdminNavItemActive(pathname, item);
          return (
            <Link
              key={item.id}
              to={item.to}
              className={`admin-sidebar__link${active ? " admin-sidebar__link--active" : ""}`}
              aria-current={active ? "page" : undefined}
              aria-label={collapsed ? item.label : undefined}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={20} strokeWidth={1.9} aria-hidden="true" />
              <span className="admin-sidebar__label">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <p className="admin-sidebar__footer admin-sidebar__label">Área de equipe · {profile?.role === "admin" ? "Admin" : "Curadoria"}</p>
    </aside>
  );
}
