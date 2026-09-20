import React, { useEffect, useRef, useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle.jsx";
import { AccountMenu, AvatarFace } from "./AccountMenu.jsx";
import { AvatarCropDialog } from "./AvatarCropDialog.jsx";
import { assertAvatarFile, cropImageToCircle, loadImageFromFile, revokeLoadedImageUrl } from "../../features/auth/avatar-crop.js";
import { adminNavItemsForRole, isAdminNavItemActive } from "../../features/admin/admin-nav-items.js";

const STAFF_ROLES = ["admin", "curator", "moderator"];
const HEADER_COMPACT_MQ = "(max-width: 1024px)";
const CANDIDATE_NAV = [
  { to: "/minhas-candidaturas", label: "Minhas candidaturas" },
];
const CANDIDATE_ACCOUNT_NAV = [
  ...CANDIDATE_NAV,
  { to: "/preferencias", label: "Privacidade" },
];

function candidateNavClassName(fadeIn) {
  if (!fadeIn) return undefined;
  return ({ isActive }) => [isActive ? "active" : null, "nav-link--hydrate"].filter(Boolean).join(" ");
}

function isStaffRole(role) {
  return STAFF_ROLES.includes(role);
}

function useHeaderCompact() {
  const [compact, setCompact] = useState(() => Boolean(window.matchMedia?.(HEADER_COMPACT_MQ)?.matches));
  useEffect(() => {
    const media = window.matchMedia?.(HEADER_COMPACT_MQ);
    if (!media) return undefined;
    const onChange = () => setCompact(media.matches);
    onChange();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    }
    media.addListener?.(onChange);
    return () => media.removeListener?.(onChange);
  }, []);
  return compact;
}

export function Header({
  logged,
  displayName,
  role,
  onSignOut,
  needsOnboarding = false,
  authReady = true,
  email = "",
  avatarUrl = null,
  identityPending = false,
  onSaveAvatar,
}) {
  const { pathname } = useLocation();
  const compactHeader = useHeaderCompact();
  const desktopAvatarUrl = compactHeader ? null : avatarUrl;
  const mobileAvatarUrl = compactHeader ? avatarUrl : null;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [gateNotice, setGateNotice] = useState("");
  const [cropImage, setCropImage] = useState(null);
  const [cropError, setCropError] = useState("");
  const [cropBusy, setCropBusy] = useState(false);
  const menuButtonRef = useRef(null);
  const avatarButtonRef = useRef(null);
  const mobileMenuTriggerRef = useRef(null);
  const photoInputRef = useRef(null);
  const closeMobileMenu = () => {
    mobileMenuTriggerRef.current?.focus();
    setMobileMenuOpen(false);
  };
  const signOut = async () => {
    await onSignOut?.();
    closeMobileMenu();
  };

  const closeCropDialog = (image = cropImage) => {
    revokeLoadedImageUrl(image);
    setCropImage(null);
    setCropError("");
  };

  const toggleMobileMenu = (triggerRef) => {
    if (cropImage) closeCropDialog();
    if (mobileMenuOpen) {
      closeMobileMenu();
      return;
    }
    mobileMenuTriggerRef.current = triggerRef.current;
    setMobileMenuOpen(true);
  };

  const openPhotoPicker = () => {
    setCropError("");
    setMobileMenuOpen(false);
    photoInputRef.current?.click();
  };

  const onPhotoPicked = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    try {
      assertAvatarFile(file);
      const image = await loadImageFromFile(file);
      setMobileMenuOpen(false);
      setCropImage(image);
      setCropError("");
    } catch (error) {
      setCropImage(null);
      setCropError(error.message || "Não foi possível usar esta imagem.");
    }
  };

  useEffect(() => {
    const image = cropImage;
    return () => revokeLoadedImageUrl(image);
  }, [cropImage]);

  const confirmCrop = async () => {
    if (!cropImage) return;
    setCropBusy(true);
    setCropError("");
    try {
      const blob = await cropImageToCircle(cropImage);
      await onSaveAvatar?.(blob);
      closeCropDialog(cropImage);
    } catch (error) {
      setCropError(error.message || "Não foi possível salvar a foto.");
    } finally {
      setCropBusy(false);
    }
  };

  useEffect(() => {
    if (!needsOnboarding) setGateNotice("");
  }, [needsOnboarding]);

  const onGatedClick = (event, extra) => {
    if (needsOnboarding) {
      event.preventDefault();
      setGateNotice("visible");
      return;
    }
    extra?.(event);
  };

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") closeMobileMenu();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const onPointerDown = (event) => {
      const menu = document.getElementById("mobile-navigation");
      if (!menu) return;
      if (menu.contains(event.target)) return;
      if (menuButtonRef.current?.contains(event.target)) return;
      if (avatarButtonRef.current?.contains(event.target)) return;
      closeMobileMenu();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [mobileMenuOpen]);

  const roleKnown = Boolean(role);
  const staff = Boolean(logged && isStaffRole(role));
  const candidate = Boolean(logged && roleKnown && !staff);
  const awaitingRole = Boolean(logged && !roleKnown);
  const prevAwaitingRole = useRef(awaitingRole);
  const fadeCandidateLinks = candidate && prevAwaitingRole.current;
  const inAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");
  const showAuthCta = Boolean(authReady) && !logged && pathname !== "/login" && !inAdminArea;

  useEffect(() => {
    prevAwaitingRole.current = awaitingRole;
  }, [awaitingRole]);

  const baseNavLinks = (onNavigate) => (
    <>
      <NavLink end to="/vagas" aria-disabled={needsOnboarding || undefined} onClick={(event) => onGatedClick(event, onNavigate)}>Vagas</NavLink>
      <NavLink to="/eventos" aria-disabled={needsOnboarding || undefined} onClick={(event) => onGatedClick(event, onNavigate)}>Eventos</NavLink>
      <NavLink end to="/newsletter" aria-disabled={needsOnboarding || undefined} onClick={(event) => onGatedClick(event, onNavigate)}>Newsletter</NavLink>
    </>
  );

  const showMobileAdminNav = staff && inAdminArea && compactHeader;

  const staffAdminLink = (onNavigate) => (
    staff || !logged ? (
      <NavLink
        to="/admin"
        aria-disabled={needsOnboarding || undefined}
        aria-current={staff && inAdminArea ? "page" : undefined}
        onClick={(event) => onGatedClick(event, onNavigate)}
      >
        Área admin
      </NavLink>
    ) : null
  );

  const mobileAdminNavSection = (onNavigate) => (
    showMobileAdminNav ? (
      <section className="mobile-nav__admin" aria-labelledby="mobile-nav-admin-heading">
        <p id="mobile-nav-admin-heading" className="mobile-nav__heading">Administração</p>
        {adminNavItemsForRole(role).map((item) => {
          const active = isAdminNavItemActive(pathname, item);
          return (
            <NavLink
              key={item.id}
              to={item.to}
              end={item.end ?? false}
              className={() => (active ? "active" : "")}
              aria-disabled={needsOnboarding || undefined}
              aria-current={active ? "page" : undefined}
              onClick={(event) => onGatedClick(event, onNavigate)}
            >
              {item.label}
            </NavLink>
          );
        })}
      </section>
    ) : null
  );

  const candidateAndStaffLinks = (onNavigate) => (
    <>
      {candidate
        ? CANDIDATE_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={candidateNavClassName(fadeCandidateLinks)}
            aria-disabled={needsOnboarding || undefined}
            onClick={(event) => onGatedClick(event, onNavigate)}
          >
            {item.label}
          </NavLink>
        ))
        : null}
      {staffAdminLink(onNavigate)}
    </>
  );

  const desktopNavLinks = (
    <>
      {baseNavLinks()}
      {awaitingRole
        ? CANDIDATE_NAV.map((item) => (
          <span key={item.to} className="nav-link-placeholder" aria-hidden="true">{item.label}</span>
        ))
        : null}
      {candidateAndStaffLinks()}
    </>
  );

  const mobileAccountSection = (onNavigate) => (
    logged ? (
      <section className="mobile-nav__account" aria-labelledby="mobile-nav-account-heading">
        <p id="mobile-nav-account-heading" className="mobile-nav__heading">Conta</p>
        <div className="mobile-nav__identity">
          <AvatarFace displayName={displayName} avatarUrl={avatarUrl} pending={identityPending} />
          <div className="mobile-nav__identity-text">
            {identityPending ? (
              <p className="mobile-nav__name mobile-nav__name--pending">Conta</p>
            ) : (
              <p className="mobile-nav__name">{displayName}</p>
            )}
            {email ? <p className="mobile-nav__email" title={email}>{email}</p> : null}
          </div>
        </div>
        {candidate ? (
          <NavLink
            to="/perfil"
            aria-disabled={needsOnboarding || undefined}
            onClick={(event) => onGatedClick(event, onNavigate)}
          >
            Editar perfil
          </NavLink>
        ) : null}
        {onSaveAvatar ? (
          <button type="button" onClick={openPhotoPicker}>Alterar foto</button>
        ) : null}
        {candidate
          ? CANDIDATE_ACCOUNT_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={candidateNavClassName(fadeCandidateLinks)}
              aria-disabled={needsOnboarding || undefined}
              onClick={(event) => onGatedClick(event, onNavigate)}
            >
              {item.label}
            </NavLink>
          ))
          : null}
      </section>
    ) : null
  );

  const mobileNavLinks = (onNavigate) => (
    <>
      {mobileAccountSection(onNavigate)}
      {mobileAdminNavSection(onNavigate)}
      {baseNavLinks(onNavigate)}
      {staffAdminLink(onNavigate)}
    </>
  );

  return (
    <header className="topbar">
      <div className="shell nav">
        <Link
          className="brand"
          to="/"
          aria-label="Ir para a página inicial"
          aria-disabled={needsOnboarding || undefined}
          onClick={(event) => onGatedClick(event)}
        >
          <span className="brand-mark"><img src="/favicon.svg" alt="" /></span>
          <span className="brand-name">GDG <span className="brand-accent">Jobs</span></span>
        </Link>
        <nav aria-label="Principal">
          {desktopNavLinks}
        </nav>
        <div className="nav-actions">
          <ThemeToggle className="hide-mobile" />
          {logged ? (
            <>
              <AccountMenu
                className="hide-mobile"
                displayName={displayName}
                email={email}
                role={role}
                avatarUrl={desktopAvatarUrl}
                identityPending={identityPending}
                needsOnboarding={needsOnboarding}
                onSignOut={signOut}
                onChangePhoto={onSaveAvatar ? openPhotoPicker : undefined}
                onGatedClick={(event) => onGatedClick(event)}
                suppressOpen={mobileMenuOpen}
                onBeforeOpen={() => setMobileMenuOpen(false)}
              />
              <button
                ref={avatarButtonRef}
                type="button"
                className="icon-button header-avatar-mobile"
                aria-label={identityPending ? "Menu da conta" : `Menu de ${displayName || "Conta"}`}
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-navigation"
                onClick={() => toggleMobileMenu(avatarButtonRef)}
              >
                <AvatarFace displayName={displayName} avatarUrl={mobileAvatarUrl} pending={identityPending} />
              </button>
              <button className="ghost hide-mobile" type="button" onClick={signOut}>
                <LogOut size={16} /> Sair
              </button>
              {onSaveAvatar ? (
                <input
                  ref={photoInputRef}
                  id="header-avatar-file"
                  name="avatar"
                  className="sr-only"
                  type="file"
                  aria-label="Enviar foto de perfil"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={onPhotoPicked}
                />
              ) : null}
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
            type="button"
            className="menu"
            onClick={() => toggleMobileMenu(menuButtonRef)}
            aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {gateNotice ? (
        <div className="nav-gate-notice-wrap">
          <p className="nav-gate-notice shell" role="status" aria-live="polite">
            Complete o perfil
            <Link to="/onboarding" className="nav-gate-notice__link">Continuar</Link>
          </p>
        </div>
      ) : null}
      {cropError && !cropImage ? (
        <div className="nav-gate-notice-wrap">
          <p className="nav-gate-notice shell" role="alert">{cropError}</p>
        </div>
      ) : null}
      {cropImage ? (
        <AvatarCropDialog
          image={cropImage}
          busy={cropBusy}
          error={cropError}
          onCancel={() => closeCropDialog()}
          onConfirm={confirmCrop}
        />
      ) : null}
      {mobileMenuOpen && (
        <div id="mobile-navigation" className="mobile-nav open" role="navigation" aria-label="Menu móvel">
          {mobileNavLinks(closeMobileMenu)}
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
