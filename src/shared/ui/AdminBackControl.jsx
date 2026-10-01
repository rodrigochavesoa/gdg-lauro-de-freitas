import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

function AdminBackContent({ children }) {
  return (
    <>
      <ArrowLeft size={17} aria-hidden="true" />
      <span>{children}</span>
    </>
  );
}

export function AdminBackButton({ children, className = "", type = "button", ...props }) {
  return (
    <button type={type} className={`admin-back-button ${className}`.trim()} {...props}>
      <AdminBackContent>{children}</AdminBackContent>
    </button>
  );
}

export function AdminBackLink({ children, className = "", ...props }) {
  return (
    <Link className={`admin-back-button ${className}`.trim()} {...props}>
      <AdminBackContent>{children}</AdminBackContent>
    </Link>
  );
}
