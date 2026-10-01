import React, { useEffect, useRef, useState } from "react";
import { Navigate, Link, useParams } from "react-router-dom";
import { ArrowLeft, BriefcaseBusiness, ExternalLink, MapPin, Users } from "lucide-react";
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
  const [nearViewport, setNearViewport] = useState(() => typeof IntersectionObserver === "undefined");
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
    if (nearViewport && profile?.avatarAvailable !== false) {
      loadCommunityAvatar(profile.publicId)
        .then((blob) => {
          if (!active) return;
          if (typeof URL.createObjectURL !== "function") return;
          objectUrl = URL.createObjectURL(blob);
          setSrc(objectUrl);
        })
        .catch(() => {
          if (active) setSrc(null);
        });
    }
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [profile?.publicId, profile?.avatarAvailable, nearViewport]);

  const initials = String(profile?.fullName ?? "?").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return src ? (
    <img ref={rootRef} className="community-avatar" loading="lazy" src={src} alt={`Foto de ${profile.fullName}`} />
  ) : (
    <span ref={rootRef} className="community-avatar community-avatar--fallback" aria-label={`Sem foto de ${profile?.fullName ?? "profissional"}`}>
      {initials || "?"}
    </span>
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
      <Link className="community-person-card__view" to={`/comunidade/${profile.publicId}`}>
        Ver perfil <span aria-hidden="true">→</span>
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

  return (
    <main id="conteudo" className="community-page" aria-busy={pageState === "loading" || pageState === "loading-list"}>
      <div className="shell community-shell">
        <header className="community-heading">
          <span className="eyebrow"><Users size={15} aria-hidden="true" /> Área de membros</span>
          <h1>{publicId ? "Perfil profissional" : "Comunidade"}</h1>
          <p>Conheça profissionais que escolheram compartilhar seus perfis com a comunidade GDG Jobs.</p>
        </header>

        {pageState === "loading" ? (publicId ? <CommunityLoadingSkeleton detail /> : <CommunityPageShellSkeleton />) : null}
        {pageState === "loading-list" ? (
          <>
            <CommunitySharePanel publication={publication} busy={busy} onPublicationChange={onPublicationChange} />
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
            <Link className="outline" to="/comunidade"><ArrowLeft size={16} /> Voltar à Comunidade</Link>
          </section>
        ) : null}
        {pageState === "list" || pageState === "empty" ? (
          <>
            <CommunitySharePanel publication={publication} busy={busy} onPublicationChange={onPublicationChange} />
            {error ? <p className="community-inline-error" role="alert">{error}</p> : null}
            {pageState === "empty" ? (
              <section className="community-empty">
                <div className="community-empty__icon"><Users size={22} aria-hidden="true" /></div>
                <h2>A comunidade está começando</h2>
                <p>Ainda não há perfis compartilhados. Quando alguém optar por participar, seu perfil aparecerá aqui.</p>
              </section>
            ) : null}
            {pageState === "list" ? <section className="community-results" aria-labelledby="community-results-heading">
              <div className="community-results__heading">
                <div><span className="eyebrow">Conexões profissionais</span><h2 id="community-results-heading">Profissionais da comunidade</h2></div>
              </div>
              <div className="community-people-grid">
                {profiles.map((profile) => <CommunityProfileCard key={profile.publicId} profile={profile} />)}
              </div>
              {nextCursor ? <button type="button" className="outline community-load-more" disabled={busy} onClick={loadMore}>{busy ? "Carregando…" : "Carregar mais perfis"}</button> : null}
            </section> : null}
          </>
        ) : null}
        {pageState === "detail" && detail ? (
          <article className="community-profile">
            <Link className="community-back" to="/comunidade"><ArrowLeft size={16} /> Voltar à Comunidade</Link>
            <section className="community-profile__hero">
              <div className="community-profile__identity"><CommunityAvatar key={detail.publicId} profile={detail} /><div><h2>{detail.fullName}</h2>{detail.headline ? <p className="community-profile__headline"><BriefcaseBusiness size={16} /> {detail.headline}</p> : null}{detail.location ? <p className="community-profile__location"><MapPin size={16} /> {detail.location}</p> : null}</div></div>
              <div className="community-profile__links">
                {[["LinkedIn", detail.linkedinUrl], ["GitHub", detail.githubUrl], ["Portfólio", detail.portfolioUrl]].map(([label, rawUrl]) => {
                  const href = safeExternalUrl(rawUrl);
                  return href ? <a key={label} className="outline" href={href} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} /> {label}</a> : null;
                })}
              </div>
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
    </main>
  );
}
