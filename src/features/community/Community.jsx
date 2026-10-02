import React, { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Link, useParams } from "react-router-dom";
import { ArrowUp, ArrowUpRight, BriefcaseBusiness, ChevronDown, Filter, Globe, MapPin, Network, Search, Users } from "lucide-react";
import { AdminBackLink } from "../../shared/ui/AdminBackControl.jsx";
import {
  COMMUNITY_LEVEL_FILTER_OPTIONS,
  COMMUNITY_WORK_MODEL_FILTER_OPTIONS,
  filterCommunityProfiles,
  formatCommunityLoadedCount,
} from "../../lib/filter-community.js";
import {
  listCommunityProfiles,
  loadCommunityAvatar,
  loadCommunityProfile,
  loadMyCommunityPublicationStatus,
  setMyCommunityPublication,
} from "./community-api.js";

const EXPERIENCE_LEVEL_NAMES = { intern: "Estágio", junior: "Júnior", mid: "Pleno", senior: "Sênior" };
const WORK_MODEL_NAMES = { remote: "Remoto", hybrid: "Híbrido", onsite: "Presencial" };

function CommunityPending() {
  return (
    <main className="community-page" aria-busy="true">
      <div className="shell community-shell">
        <CommunityPageShellSkeleton />
      </div>
    </main>
  );
}

/** Placeholder compacto enquanto o status da Comunidade carrega — não imita cards de perfil. */
function CommunityPageShellSkeleton() {
  return (
    <section className="community-skeleton community-skeleton--page" aria-busy="true" aria-label="Carregando Comunidade">
      <span className="detail-skeleton-sr" role="status">Carregando Comunidade…</span>
      <div className="community-skeleton-card community-skeleton-card--page" aria-hidden="true">
        <span className="community-skeleton-line community-skeleton-line--heading" />
        <span className="community-skeleton-line" />
        <span className="community-skeleton-line community-skeleton-line--short" />
      </div>
    </section>
  );
}

/** Lista em carregamento: não usa cards de perfil (evita grid 3 colunas no desktop ao lado do opt-in). */
function CommunityResultsLoadingPlaceholder() {
  return (
    <section className="community-results community-results--loading" aria-busy="true" aria-labelledby="community-results-loading-label">
      <span className="detail-skeleton-sr" id="community-results-loading-label" role="status">Carregando perfis da Comunidade…</span>
      <div className="community-results__heading" aria-hidden="true">
        <span className="community-skeleton-line community-skeleton-line--heading" />
      </div>
      <div className="community-results-skeleton" aria-hidden="true">
        <span className="community-skeleton-line" />
        <span className="community-skeleton-line community-skeleton-line--short" />
      </div>
    </section>
  );
}

function CommunityLoadingSkeleton({ detail = false }) {
  return (
    <section className="community-skeleton" aria-busy="true" aria-label={detail ? "Carregando perfil profissional" : "Carregando perfis da Comunidade"}>
      <span className="detail-skeleton-sr" role="status">Carregando {detail ? "perfil profissional" : "perfis da Comunidade"}…</span>
      {detail ? (
        <article className="community-profile" aria-hidden="true">
          <div className="community-profile__hero community-skeleton-card">
            <div className="community-skeleton-identity"><span className="community-skeleton-avatar" /><div><span className="community-skeleton-line community-skeleton-line--title" /><span className="community-skeleton-line community-skeleton-line--meta" /></div></div>
            <span className="community-skeleton-line community-skeleton-line--links" />
          </div>
          <div className="community-profile__section community-skeleton-card"><span className="community-skeleton-line community-skeleton-line--heading" /><span className="community-skeleton-line" /><span className="community-skeleton-line community-skeleton-line--short" /></div>
          <div className="community-profile__section community-skeleton-card"><span className="community-skeleton-line community-skeleton-line--heading" /><span className="community-skeleton-line" /><span className="community-skeleton-line community-skeleton-line--short" /></div>
        </article>
      ) : (
        <div className="community-people-grid" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => (
            <article className="community-person-card community-skeleton-card" key={index}>
              <div className="community-skeleton-identity"><span className="community-skeleton-avatar" /><div><span className="community-skeleton-line community-skeleton-line--title" /><span className="community-skeleton-line community-skeleton-line--meta" /></div></div>
              <span className="community-skeleton-line" /><span className="community-skeleton-line community-skeleton-line--short" /><span className="community-skeleton-line community-skeleton-line--action" />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function CommunityRoute({ auth, authReady }) {
  if (!authReady || (auth.session && !auth.profile)) return <CommunityPending />;
  if (!auth.session) return <Navigate to="/login" replace />;
  if (auth.needsOnboarding) return <Navigate to="/onboarding" replace />;
  return <CommunityPage key={auth.session.user.id} userId={auth.session.user.id} />;
}

function safeExternalUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function CommunityAvatar({ profile }) {
  const rootRef = useRef(null);
  const [src, setSrc] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [nearViewport, setNearViewport] = useState(() => typeof IntersectionObserver === "undefined");
  const shouldLoadAvatar = profile?.avatarAvailable === true;
  useEffect(() => {
    const root = rootRef.current;
    if (!root || nearViewport || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      setNearViewport(true);
      observer.disconnect();
    }, { rootMargin: "160px" });
    observer.observe(root);
    return () => observer.disconnect();
  }, [nearViewport]);
  useEffect(() => {
    let active = true;
    let objectUrl = null;
    setSrc(null);
    setLoadFailed(false);
    if (nearViewport && shouldLoadAvatar) {
      loadCommunityAvatar(profile.publicId)
        .then((blob) => {
          if (!active) return;
          if (typeof URL.createObjectURL !== "function") return;
          objectUrl = URL.createObjectURL(blob);
          setSrc(objectUrl);
        })
        .catch(() => {
          if (active) {
            setSrc(null);
            setLoadFailed(true);
          }
        });
    }
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [profile?.publicId, shouldLoadAvatar, nearViewport]);

  const initials = String(profile?.fullName ?? "?").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  if (src) {
    return <img ref={rootRef} className="community-avatar" loading="lazy" src={src} alt={`Foto de ${profile.fullName}`} />;
  }
  if (shouldLoadAvatar && !loadFailed) {
    return <span ref={rootRef} className="community-avatar community-avatar--loading" aria-hidden="true" />;
  }
  return (
    <span ref={rootRef} className="community-avatar community-avatar--fallback" aria-label={`Sem foto de ${profile?.fullName ?? "profissional"}`}>
      {initials || "?"}
    </span>
  );
}

function CommunityLinkedInIcon({ className, size = 18 }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-11h4v2" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

function CommunityGitHubIcon({ className, size = 18 }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-.1.56-.2.84-.3C15.64 2.8 14.5 2 13 2h-2c-1.5 0-2.64.8-3.15 1.95-.28.1-.56.2-.84.3-.73 1.02-1.08 2.25-1 3.5 0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

const COMMUNITY_SOCIAL_LINKS = [
  { key: "linkedin", label: "LinkedIn", field: "linkedinUrl", Icon: CommunityLinkedInIcon },
  { key: "github", label: "GitHub", field: "githubUrl", Icon: CommunityGitHubIcon },
  { key: "portfolio", label: "Portfólio", field: "portfolioUrl", Icon: Globe },
];

function CommunityProfileSocialLinks({ profile }) {
  const links = COMMUNITY_SOCIAL_LINKS.map((entry) => {
    const href = safeExternalUrl(profile?.[entry.field]);
    return href ? { ...entry, href } : null;
  }).filter(Boolean);
  if (!links.length) return null;
  return (
    <div className="community-profile__links">
      {links.map((link) => {
        const SocialIcon = link.Icon;
        return (
          <a
            key={link.key}
            className="outline community-social-link"
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            <SocialIcon className="community-social-link__icon" size={18} aria-hidden="true" />
            <span>{link.label}</span>
          </a>
        );
      })}
    </div>
  );
}

function CommunityBrowseWaveDivider() {
  return (
    <div className="home-divider" aria-hidden="true">
      <svg className="home-divider__curve" viewBox="0 0 1440 120" preserveAspectRatio="none" focusable="false">
        <path fill="var(--color-surface)" stroke="none" d="M-8 52 C 180 118 380 14 560 64 C 740 112 920 8 1100 58 C 1240 96 1360 22 1448 48 L 1448 128 L -8 128 Z" />
      </svg>
      <img className="home-divider__avatar" src="/avatar-gdgjobs.png" alt="" width={1169} height={987} loading="eager" decoding="async" />
    </div>
  );
}

function CommunityBrowseHero({ query, disabled, onQueryChange, onSearch }) {
  return (
    <section className="hero community-browse-hero" aria-labelledby="community-browse-title">
      <div className="shell hero-content">
        <span className="eyebrow"><Network size={16} aria-hidden="true" /> Comunidade GDG Jobs</span>
        <h1 id="community-browse-title">Encontre sua próxima <em>conexão em tech.</em></h1>
        <p>
          Conheça profissionais que escolheram compartilhar seus perfis e descubra novas conexões na comunidade.
        </p>
        <form className="searchbox community-browse-searchbox" role="search" aria-label="Buscar profissionais da comunidade" onSubmit={(event) => { event.preventDefault(); onSearch(); }}>
          <Search size={21} aria-hidden="true" />
          <input
            type="search"
            name="community-query"
            value={query}
            disabled={disabled}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Nome, tecnologia ou área de atuação"
            aria-label="Nome, tecnologia ou área de atuação"
          />
          <button className="primary" type="submit" disabled={disabled}>Buscar profissionais <ArrowUpRight size={17} aria-hidden="true" /></button>
        </form>
      </div>
    </section>
  );
}

function CommunityBrowseToolbar({
  filtersOpen,
  activeFilterCount,
  experienceLevel,
  workModel,
  disabled,
  onToggleFilters,
  onExperienceLevelChange,
  onWorkModelChange,
}) {
  return (
    <div className="community-browse-toolbar">
      <button
        type="button"
        className="outline community-browse-filters-toggle"
        aria-expanded={filtersOpen}
        aria-controls="community-browse-filters-panel"
        disabled={disabled}
        onClick={onToggleFilters}
      >
        <Filter size={16} aria-hidden="true" />
        Filtros
        {activeFilterCount > 0 ? <b>{activeFilterCount}</b> : null}
      </button>
      {filtersOpen ? (
        <div id="community-browse-filters-panel" className="community-browse-filters-panel" role="group" aria-label="Filtros da comunidade">
          <label className="community-browse-select">
            <span className="community-browse-select__label">Nível de experiência</span>
            <select
              className="sort"
              name="community-experience-level"
              value={experienceLevel}
              disabled={disabled}
              onChange={(event) => onExperienceLevelChange(event.target.value)}
              aria-label="Filtrar por nível de experiência"
            >
              {COMMUNITY_LEVEL_FILTER_OPTIONS.map((option) => (
                <option key={option.value || "all-levels"} value={option.value}>{option.label}</option>
              ))}
            </select>
            <ChevronDown size={16} className="community-browse-select__chevron" aria-hidden="true" />
          </label>
          <label className="community-browse-select">
            <span className="community-browse-select__label">Modalidade de trabalho</span>
            <select
              className="sort"
              name="community-work-model"
              value={workModel}
              disabled={disabled}
              onChange={(event) => onWorkModelChange(event.target.value)}
              aria-label="Filtrar por modalidade de trabalho"
            >
              {COMMUNITY_WORK_MODEL_FILTER_OPTIONS.map((option) => (
                <option key={option.value || "all-models"} value={option.value}>{option.label}</option>
              ))}
            </select>
            <ChevronDown size={16} className="community-browse-select__chevron" aria-hidden="true" />
          </label>
        </div>
      ) : null}
    </div>
  );
}

function CommunityBackToTop({ visible }) {
  if (!visible) return null;
  return (
    <button
      type="button"
      className="community-back-to-top"
      aria-label="Voltar ao topo"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    >
      <ArrowUp size={18} aria-hidden="true" />
    </button>
  );
}

function CommunityPublishedBanner() {
  return (
    <section className="community-published-banner" aria-live="polite">
      <p>
        Seu perfil está visível para membros autenticados da Comunidade.{" "}
        <Link to="/preferencias">Gerenciar compartilhamento</Link>
      </p>
    </section>
  );
}

function CommunityDiscoverySection({
  catalogEmpty,
  filteredProfiles,
  resultCountLabel,
  nextCursor,
  busy,
  onLoadMore,
}) {
  const filterEmpty = !catalogEmpty && filteredProfiles.length === 0;
  return (
    <section className="community-results" aria-labelledby="community-results-heading">
      <div className="community-results__heading">
        <h2 id="community-results-heading">Profissionais da comunidade</h2>
        <p className="community-results__meta">{resultCountLabel}</p>
      </div>
      {catalogEmpty ? (
        <div className="community-empty community-empty--in-results">
          <div className="community-empty__icon"><Users size={22} aria-hidden="true" /></div>
          <h3>A comunidade está começando</h3>
          <p>Ainda não há outros perfis compartilhados. Quando alguém optar por participar, aparecerá aqui.</p>
        </div>
      ) : filterEmpty ? (
        <div className="community-empty community-empty--in-results">
          <h3>Nenhum perfil encontrado</h3>
          <p>Ajuste a busca ou os filtros para ver outros profissionais compartilhados.</p>
        </div>
      ) : (
        <>
          <div className="community-people-grid">
            {filteredProfiles.map((profile) => <CommunityProfileCard key={profile.publicId} profile={profile} />)}
          </div>
          {nextCursor ? (
            <button type="button" className="outline community-load-more" disabled={busy} onClick={onLoadMore}>
              {busy ? "Carregando…" : "Carregar mais perfis"}
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}

function CommunitySharePanel({ publication, busy, onPublicationChange }) {
  if (!publication) return null;
  return (
    <section className="community-share" aria-labelledby="community-share-heading">
      <div>
        <span className="eyebrow">Seu perfil</span>
        <h2 id="community-share-heading">Escolha se quer aparecer na Comunidade</h2>
        {publication.canPublish ? (
          <>
            <p>Ao ativar, seu perfil ficará visível para os membros autenticados da Comunidade, para que possam conhecer seu trabalho e fazer conexões profissionais.</p>
            <p>Serão exibidos seu nome, foto (se houver), título profissional, competências, localização, experiência, modelo de trabalho, apresentação e links profissionais. E-mail, telefone, currículo e dados privados da conta não aparecem.</p>
            <p>Você pode retirar seu perfil quando quiser. A retirada remove a publicação e bloqueia novas entregas da foto, mas não recolhe cópias que alguém já tenha feito.</p>
            <Link to="/preferencias">Consulte a finalidade e o registro desta escolha em Preferências de privacidade.</Link>
          </>
        ) : (
          <>
            <p>Quando habilitado, o compartilhamento será opcional e visível somente a membros autenticados. O perfil pode incluir nome, foto, título profissional, competências, localização, experiência, modelo de trabalho, apresentação e links; e-mail, telefone, currículo e dados privados não são exibidos.</p>
            <p>{publication.reasonCode === "profile_incomplete" ? "Complete seu perfil profissional para habilitar o compartilhamento." : "O piloto ainda não está habilitado neste ambiente. Nenhum perfil está sendo divulgado."}</p>
            <Link to="/preferencias">Consulte a finalidade e o registro desta escolha em Preferências de privacidade.</Link>
          </>
        )}
      </div>
      {publication.canPublish ? (
        <label className="community-share__toggle">
          <input type="checkbox" checked={publication.published} disabled={busy} onChange={onPublicationChange} />
          <span>Quero compartilhar meu perfil</span>
        </label>
      ) : (
        <p className="community-share__pending">Compartilhamento temporariamente indisponível.</p>
      )}
    </section>
  );
}

function CommunityProfileCard({ profile }) {
  return (
    <article className="community-person-card">
      <Link className="community-person-card__identity" to={`/comunidade/${profile.publicId}`} aria-label={`Ver perfil de ${profile.fullName}`}>
        <CommunityAvatar profile={profile} />
        <span className="community-person-card__heading">
          <strong>{profile.fullName}</strong>
          {profile.location ? <span><MapPin size={15} aria-hidden="true" /> {profile.location}</span> : null}
        </span>
      </Link>
      <div className="community-person-card__facts">
        {profile.headline ? <p><span>Atuação</span><strong>{profile.headline}</strong></p> : null}
        {profile.skills?.length ? <p><span>Tecnologias</span><strong>{profile.skills.slice(0, 3).join(" · ")}</strong></p> : null}
        {profile.experienceLevel ? <p><span>Nível</span><strong>{EXPERIENCE_LEVEL_NAMES[profile.experienceLevel] ?? profile.experienceLevel}</strong></p> : null}
        {profile.workModel ? <p><span>Modalidade</span><strong>{WORK_MODEL_NAMES[profile.workModel] ?? profile.workModel}</strong></p> : null}
      </div>
      <Link className="primary community-person-card__cta" to={`/comunidade/${profile.publicId}`}>
        <span>Ver perfil</span>
        <span className="round-arrow" aria-hidden="true"><ArrowUpRight size={18} /></span>
      </Link>
    </article>
  );
}

function CommunityPage({ userId }) {
  const { publicId } = useParams();
  const [publication, setPublication] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [detail, setDetail] = useState(null);
  const [pageState, setPageState] = useState("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [browseQuery, setBrowseQuery] = useState("");
  const [browseQueryDraft, setBrowseQueryDraft] = useState("");
  const [browseExperienceLevel, setBrowseExperienceLevel] = useState("");
  const [browseWorkModel, setBrowseWorkModel] = useState("");
  const [browseFiltersOpen, setBrowseFiltersOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const browseActiveFilterCount = Number(Boolean(browseExperienceLevel)) + Number(Boolean(browseWorkModel));

  const showBrowseChrome = !publicId && (pageState === "loading-list" || pageState === "list" || pageState === "empty");
  const showBrowseLayout = showBrowseChrome;
  const browseHeroDisabled = pageState === "loading-list";
  const filteredProfiles = useMemo(
    () => filterCommunityProfiles(profiles, {
      query: browseQuery,
      experienceLevel: browseExperienceLevel,
      workModel: browseWorkModel,
    }),
    [profiles, browseQuery, browseExperienceLevel, browseWorkModel],
  );
  const resultCountLabel = formatCommunityLoadedCount(filteredProfiles.length, Boolean(nextCursor));

  useEffect(() => {
    if (!showBrowseLayout || profiles.length < 4) {
      setShowBackToTop(false);
      return undefined;
    }
    const onScroll = () => setShowBackToTop(window.scrollY > 480);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [showBrowseLayout, profiles.length]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      setPageState("loading");
      setError("");
      setDetail(null);
      try {
        const status = await loadMyCommunityPublicationStatus();
        if (!active) return;
        setPublication(status);
        if (status.reasonCode === "approval_pending") {
          setPageState("unavailable");
          return;
        }
        if (publicId) {
          const profile = await loadCommunityProfile(publicId);
          if (!active) return;
          setDetail(profile);
          setPageState(profile ? "detail" : "not-found");
        } else {
          setPageState("loading-list");
          const result = await listCommunityProfiles();
          if (!active) return;
          setProfiles(result.items);
          setNextCursor(result.nextCursor);
          setPageState(result.items.length ? "list" : "empty");
        }
      } catch (loadError) {
        if (!active) return;
        setError(loadError?.message || "Não foi possível carregar a Comunidade. Tente novamente.");
        setPageState("error");
      }
    };
    run();
    return () => { active = false; };
  }, [userId, publicId, reloadToken]);

  const onPublicationChange = async (event) => {
    const enabled = event.target.checked;
    setBusy(true);
    setError("");
    try {
      const published = await setMyCommunityPublication(enabled);
      setPublication((current) => ({ ...current, published }));
      try {
        const result = await listCommunityProfiles();
        setProfiles(result.items);
        setNextCursor(result.nextCursor);
        setPageState(result.items.length ? "list" : "empty");
      } catch {
        setError("Sua escolha foi salva, mas não foi possível atualizar a lista. Tente novamente.");
      }
    } catch (saveError) {
      setError(saveError?.message || "Não foi possível atualizar o compartilhamento.");
    } finally {
      setBusy(false);
    }
  };

  const showShareOnboarding = Boolean(publication?.canPublish && !publication?.published);

  const loadMore = async () => {
    if (!nextCursor || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await listCommunityProfiles({ cursor: nextCursor });
      setProfiles((current) => [...current, ...result.items.filter((item) => !current.some((existing) => existing.publicId === item.publicId))]);
      setNextCursor(result.nextCursor);
    } catch (loadError) {
      setError(loadError?.message || "Não foi possível carregar mais perfis.");
    } finally {
      setBusy(false);
    }
  };

  const browseHero = showBrowseLayout ? (
    <>
      <CommunityBrowseHero
        query={browseQueryDraft}
        disabled={browseHeroDisabled}
        onQueryChange={setBrowseQueryDraft}
        onSearch={() => setBrowseQuery(browseQueryDraft.trim())}
      />
      <CommunityBrowseWaveDivider />
    </>
  ) : null;

  return (
    <main id="conteudo" className={`community-page${showBrowseLayout ? " community-page--browse" : ""}`} aria-busy={pageState === "loading" || pageState === "loading-list"}>
      {browseHero}
      <div className="shell community-shell">
        {!showBrowseChrome ? (
          <header className="community-heading">
            <span className="eyebrow"><Users size={15} aria-hidden="true" /> Área de membros</span>
            <h1>{publicId ? "Perfil profissional" : "Comunidade"}</h1>
            <p>Conheça profissionais que escolheram compartilhar seus perfis com a comunidade GDG Jobs.</p>
          </header>
        ) : null}

        {pageState === "loading" ? (publicId ? <CommunityLoadingSkeleton detail /> : <CommunityPageShellSkeleton />) : null}
        {pageState === "loading-list" ? (
          <>
            {showShareOnboarding ? (
              <CommunitySharePanel publication={publication} busy={busy} onPublicationChange={onPublicationChange} />
            ) : publication?.published ? <CommunityPublishedBanner /> : null}
            <CommunityBrowseToolbar
              filtersOpen={browseFiltersOpen}
              activeFilterCount={browseActiveFilterCount}
              experienceLevel={browseExperienceLevel}
              workModel={browseWorkModel}
              disabled
              onToggleFilters={() => setBrowseFiltersOpen((open) => !open)}
              onExperienceLevelChange={setBrowseExperienceLevel}
              onWorkModelChange={setBrowseWorkModel}
            />
            <CommunityResultsLoadingPlaceholder />
          </>
        ) : null}
        {pageState === "unavailable" ? (
          <section className="community-notice" role="status">
            <h2>Compartilhamento ainda não disponível</h2>
            <p>A publicação está desativada neste ambiente enquanto a finalidade de privacidade passa por aprovação. Nenhum perfil ou foto é carregado nesta etapa.</p>
            <p>Quando habilitado, o compartilhamento será opcional e visível somente a membros autenticados. Poderá incluir nome, foto (se houver), título profissional, competências, localização, experiência, modelo de trabalho, apresentação e links profissionais. E-mail, telefone, currículo e dados privados da conta não serão exibidos.</p>
            <p>A publicação permanecerá visível enquanto você mantiver o opt-in. Ao retirar a autorização ou excluir a conta, o perfil será removido das consultas e novas entregas da foto serão bloqueadas. Cópias já obtidas por outros membros não podem ser recolhidas.</p>
            <Link to="/preferencias">Consulte as finalidades e os registros de privacidade.</Link>
          </section>
        ) : null}
        {pageState === "error" ? (
          <section className="community-notice community-notice--error" role="alert">
            <p>{error}</p>
            <button className="outline" type="button" onClick={() => setReloadToken((value) => value + 1)}>Tentar novamente</button>
          </section>
        ) : null}
        {pageState === "not-found" ? (
          <section className="community-notice" role="status">
            <h2>Este perfil não está disponível</h2>
            <p>Pode ter sido removido da Comunidade ou o endereço está incorreto.</p>
            <AdminBackLink to="/comunidade">Voltar à Comunidade</AdminBackLink>
          </section>
        ) : null}
        {pageState === "list" || pageState === "empty" ? (
          <>
            {showShareOnboarding ? (
              <CommunitySharePanel publication={publication} busy={busy} onPublicationChange={onPublicationChange} />
            ) : publication?.published ? (
              <CommunityPublishedBanner />
            ) : (
              <CommunitySharePanel publication={publication} busy={busy} onPublicationChange={onPublicationChange} />
            )}
            {error ? <p className="community-inline-error" role="alert">{error}</p> : null}
            <CommunityBrowseToolbar
              filtersOpen={browseFiltersOpen}
              activeFilterCount={browseActiveFilterCount}
              experienceLevel={browseExperienceLevel}
              workModel={browseWorkModel}
              disabled={false}
              onToggleFilters={() => setBrowseFiltersOpen((open) => !open)}
              onExperienceLevelChange={setBrowseExperienceLevel}
              onWorkModelChange={setBrowseWorkModel}
            />
            <CommunityDiscoverySection
              catalogEmpty={profiles.length === 0}
              filteredProfiles={filteredProfiles}
              resultCountLabel={resultCountLabel}
              nextCursor={nextCursor}
              busy={busy}
              onLoadMore={loadMore}
            />
          </>
        ) : null}
        {pageState === "detail" && detail ? (
          <article className="community-profile">
            <AdminBackLink className="community-profile__back" to="/comunidade">Voltar à Comunidade</AdminBackLink>
            <section className="community-profile__hero">
              <div className="community-profile__identity"><CommunityAvatar key={detail.publicId} profile={detail} /><div><h2>{detail.fullName}</h2>{detail.headline ? <p className="community-profile__headline"><BriefcaseBusiness size={16} /> {detail.headline}</p> : null}{detail.location ? <p className="community-profile__location"><MapPin size={16} /> {detail.location}</p> : null}</div></div>
              <CommunityProfileSocialLinks profile={detail} />
            </section>
            {detail.bio ? <section className="community-profile__section"><h3>Sobre</h3><p>{detail.bio}</p></section> : null}
            <section className="community-profile__section">
              <h3>Informações profissionais</h3>
              <div className="community-profile__facts">
                {detail.skills?.length ? <p><span>Tecnologias</span><strong>{detail.skills.join(" · ")}</strong></p> : null}
                {detail.experienceLevel ? <p><span>Nível de experiência</span><strong>{EXPERIENCE_LEVEL_NAMES[detail.experienceLevel] ?? detail.experienceLevel}</strong></p> : null}
                {detail.workModel ? <p><span>Modalidade</span><strong>{WORK_MODEL_NAMES[detail.workModel] ?? detail.workModel}</strong></p> : null}
                {detail.location ? <p><span>Localidade</span><strong>{detail.location}</strong></p> : null}
              </div>
            </section>
          </article>
        ) : null}
      </div>
      <CommunityBackToTop visible={showBackToTop} />
    </main>
  );
}
