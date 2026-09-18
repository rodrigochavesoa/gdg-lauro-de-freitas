import React, { useEffect, useId, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { Link } from "react-router-dom";

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

function truncatedEmail(email) {
  const value = String(email ?? "").trim();
  if (value.length <= 28) return value;
  const [local, domain] = value.split("@");
  if (!domain) return `${value.slice(0, 25)}…`;
  const keep = Math.max(3, 22 - domain.length);
  return `${local.slice(0, keep)}…@${domain}`;
}

function AvatarFace({ displayName, avatarUrl, pending = false, sizeClass = "avatar" }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [avatarUrl]);
  if (pending) {
    return <span className={`${sizeClass} avatar--pending`} aria-hidden="true" />;
  }
  const showPhoto = Boolean(avatarUrl) && !failed;
  return (
    <span className={sizeClass}>
      {showPhoto ? (
        <img src={avatarUrl} alt="" onError={() => setFailed(true)} />
      ) : (
        initialsFrom(displayName)
      )}
    </span>
  );
}

export function AccountMenu({
  displayName,
  email,
  role,
  avatarUrl,
  identityPending = false,
  needsOnboarding = false,
  onSignOut,
  onChangePhoto,
  onGatedClick,
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const titleId = useId();
  const staff = STAFF_ROLES.includes(role);
  const candidate = Boolean(role) && !staff;
  const leaveTimer = useRef(null);
  const hoverOpens = Boolean(typeof window !== "undefined" && window.matchMedia?.("(hover: hover) and (pointer: fine)")?.matches);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (event) => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const clearLeave = () => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  };

  const onEnter = () => {
    clearLeave();
    setOpen(true);
  };

  const onLeave = () => {
    clearLeave();
    leaveTimer.current = setTimeout(() => setOpen(false), 160);
  };

  return (
    <div
      className="account-menu"
      ref={wrapRef}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <button
        ref={triggerRef}
        className="icon-button"
        type="button"
        aria-label={identityPending ? "Conta" : displayName || "Conta"}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? "account-popover" : undefined}
        onClick={() => {
          if (hoverOpens) {
            setOpen(true);
            return;
          }
          setOpen((value) => !value);
        }}
      >
        <AvatarFace displayName={displayName} avatarUrl={avatarUrl} pending={identityPending} />
      </button>
      {open ? (
        <div
          id="account-popover"
          className="account-popover"
          role="dialog"
          aria-labelledby={titleId}
        >
          <AvatarFace displayName={displayName} avatarUrl={avatarUrl} pending={identityPending} sizeClass="avatar avatar--lg" />
          {identityPending ? (
            <p id={titleId} className="account-popover__name account-popover__name--pending">Conta</p>
          ) : (
            <p id={titleId} className="account-popover__name">{displayName}</p>
          )}
          {email ? <p className="account-popover__email" title={email}>{truncatedEmail(email)}</p> : null}
          <div className="account-popover__actions">
            {candidate ? (
              <>
                <Link
                  to="/perfil"
                  aria-disabled={needsOnboarding || undefined}
                  onClick={(event) => {
                    onGatedClick?.(event);
                    if (!needsOnboarding) setOpen(false);
                  }}
                >
                  Editar perfil
                </Link>
                <Link
                  to="/minhas-candidaturas"
                  aria-disabled={needsOnboarding || undefined}
                  onClick={(event) => {
                    onGatedClick?.(event);
                    if (!needsOnboarding) setOpen(false);
                  }}
                >
                  Minhas candidaturas
                </Link>
                <Link
                  to="/preferencias"
                  aria-disabled={needsOnboarding || undefined}
                  onClick={(event) => {
                    onGatedClick?.(event);
                    if (!needsOnboarding) setOpen(false);
                  }}
                >
                  Privacidade
                </Link>
              </>
            ) : null}
            {onChangePhoto ? (
              <button type="button" onClick={onChangePhoto}>Alterar foto</button>
            ) : null}
            <button type="button" onClick={onSignOut}><LogOut size={16} /> Sair</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
