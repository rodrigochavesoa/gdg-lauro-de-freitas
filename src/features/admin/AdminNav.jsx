import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { adminNavItemsForRole, isAdminNavItemActive } from "./admin-nav-items.js";

function tabClass(isActive) {
  return isActive ? "primary small" : "ghost";
}

export function AdminNav({ profile }) {
  const { pathname } = useLocation();
  const items = adminNavItemsForRole(profile?.role);

  return (
    <nav className="admin-tabs" aria-label="Seções da área administrativa">
      {items.map((item) => (
        <NavLink
          key={item.id}
          to={item.to}
          end={item.end ?? false}
          className={() => tabClass(isAdminNavItemActive(pathname, item))}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
