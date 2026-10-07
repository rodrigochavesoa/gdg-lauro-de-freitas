import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight, BadgeCheck, BriefcaseBusiness,
  Check, ChevronDown, CircleDollarSign, Filter,
  MapPin, Search, Sparkles, Users
} from "lucide-react";
import { FilterSheet } from "../../shared/ui/FilterSheet.jsx";
import {
  CATALOG_COUNTRIES,
  centsFromReaisInput,
  parseCatalogSearch,
  reaisInputFromCents,
  writeCatalogSearch,
} from "../../lib/catalog-url.js";
import {
  CATALOG_LEVELS,
  CATALOG_TECHNOLOGIES,
  CATALOG_WORK_MODELS,
  SORT_OLDEST,
  SORT_MATCH,
  SORT_RECENT,
  formOptionId,
  toggleFilterValue,
} from "../../lib/filter-jobs.js";
import { loadApprovedJobs, peekApprovedJobsPage } from "./jobs-api.js";
import { Link, useSearchParams } from "react-router-dom";
import { ResponsiveAssetImage } from "../../shared/ui/ResponsiveAssetImage.jsx";
import { isCandidateProfile, isD01Complete } from "../auth/profile-completeness.js";
import {
  isPrivacyPurposeAuthorizedForCurrentUser,
  subscribePrivacyPreferencesInvalidation,
} from "../privacy/privacy-api.js";
import { rankJobsByCompatibility } from "../../lib/matching/deterministic-match.js";

function mergeJobsById(current, incoming) {
  const seen = new Set(current.map((job) => String(job.id)));
  const extra = incoming.filter((job) => !seen.has(String(job.id)));
  return [...current, ...extra];
}

function toLoadParams(filters, query) {
  return {
    query,
    tech: filters.tech,
    level: filters.level,
    workModel: filters.workModel,
    sort: filters.sort,
    country: filters.country,
    place: filters.place,
    salaryMin: filters.salaryMin,
    salaryMax: filters.salaryMax,
  };
}

function sortAccumulatedJobs(jobs, sort) {
  return [...jobs].sort((left, right) => {
    const leftDate = Date.parse(left.postedAt ?? "") || 0;
    const rightDate = Date.parse(right.postedAt ?? "") || 0;
    const dateDifference = sort === SORT_OLDEST ? leftDate - rightDate : rightDate - leftDate;
    if (dateDifference) return dateDifference;
    const leftId = String(left.id ?? "");
    const rightId = String(right.id ?? "");
    return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
  });
}

function catalogFilterParams(params) {
  const filters = { ...params };
  delete filters.sort;
  return filters;
}

export function Home({ logged = false, userId = null, profile = null, email = "", authReady = true, profileReady = true }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchKey = searchParams.toString();
  const urlFilters = useMemo(() => parseCatalogSearch(searchKey), [searchKey]);
  const urlQuery = urlFilters.query;
  const [query, setQuery] = useState(() => urlQuery);
  const [placeDraft, setPlaceDraft] = useState(() => urlFilters.place);
  const [salaryMinDraft, setSalaryMinDraft] = useState(() => reaisInputFromCents(urlFilters.salaryMin));
  const [salaryMaxDraft, setSalaryMaxDraft] = useState(() => reaisInputFromCents(urlFilters.salaryMax));
  const [salaryError, setSalaryError] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const initialLoadParams = toLoadParams(urlFilters, urlQuery);
  const initialPage = peekApprovedJobsPage(initialLoadParams);
  const [jobs, setJobs] = useState(() => initialPage?.jobs ?? []);
  const [resultCount, setResultCount] = useState(() => initialPage?.count ?? null);
  const [catalogStatus, setCatalogStatus] = useState(() => (initialPage ? "ready" : "loading"));
  const [loadingMore, setLoadingMore] = useState(false);
  const [paginationWasUsed, setPaginationWasUsed] = useState(false);
  const [catalogReorderAnnouncement, setCatalogReorderAnnouncement] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const loadParams = toLoadParams(urlFilters, urlQuery);
  const loadParamsRef = useRef(loadParams);
  loadParamsRef.current = loadParams;
  const paginationSortRef = useRef(initialLoadParams.sort === SORT_OLDEST ? SORT_OLDEST : SORT_RECENT);
  const requestedCatalogSort = urlFilters.sort === SORT_OLDEST ? SORT_OLDEST : SORT_RECENT;
  const loadSortKey = urlFilters.sort === SORT_MATCH
    ? paginationSortRef.current
    : requestedCatalogSort;
  const loadFilterKey = JSON.stringify({
    query: loadParams.query,
    tech: loadParams.tech,
    level: loadParams.level,
    workModel: loadParams.workModel,
    country: loadParams.country,
    place: loadParams.place,
    salaryMin: loadParams.salaryMin,
    salaryMax: loadParams.salaryMax,
    sort: loadSortKey,
  });
  const loadGenerationRef = useRef(0);
  const privacyGenerationRef = useRef(0);
  const [privacyGate, setPrivacyGate] = useState({ userId: null, status: "idle", authorized: false });
  const privacyGateRef = useRef(privacyGate);
  privacyGateRef.current = privacyGate;
  const candidate = logged && isCandidateProfile(profile);

  const refreshPrivacyGate = useCallback(({ preserveAuthorizationWhileChecking = false } = {}) => {
    const generation = ++privacyGenerationRef.current;
    if (!authReady || !logged || !profileReady || !userId || !candidate) {
      const nextGate = { userId: userId ?? null, status: "idle", authorized: false };
      privacyGateRef.current = nextGate;
      setPrivacyGate(nextGate);
      return;
    }

    const previousGate = privacyGateRef.current;
    const keepCurrentAuthorization = preserveAuthorizationWhileChecking &&
      previousGate.userId === userId && previousGate.status === "ready" && previousGate.authorized;
    if (!keepCurrentAuthorization) {
      const loadingGate = { userId, status: "loading", authorized: false };
      privacyGateRef.current = loadingGate;
      setPrivacyGate(loadingGate);
    }
    isPrivacyPurposeAuthorizedForCurrentUser("F-06")
      .then((authorized) => {
        if (generation !== privacyGenerationRef.current) return;
        const nextGate = { userId, status: "ready", authorized: authorized === true };
        privacyGateRef.current = nextGate;
        setPrivacyGate(nextGate);
      })
      .catch(() => {
        if (generation !== privacyGenerationRef.current) return;
        const unavailableGate = { userId, status: "unavailable", authorized: false };
        privacyGateRef.current = unavailableGate;
        setPrivacyGate(unavailableGate);
      });
  }, [authReady, candidate, logged, profileReady, userId]);

  useEffect(() => {
    refreshPrivacyGate();
    return () => { privacyGenerationRef.current += 1; };
  }, [refreshPrivacyGate]);

  useEffect(() => subscribePrivacyPreferencesInvalidation((invalidatedUserId) => {
    if (!invalidatedUserId || invalidatedUserId === userId) {
      // Cache invalidation closes personalization immediately; revalidation happens on focus/remount.
      const revokedGate = { userId: userId ?? null, status: "ready", authorized: false };
      privacyGateRef.current = revokedGate;
      setPrivacyGate(revokedGate);
    }
  }), [userId]);

  useEffect(() => {
    if (!userId || !logged || !candidate) return undefined;
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        refreshPrivacyGate({ preserveAuthorizationWhileChecking: true });
      }
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [candidate, logged, refreshPrivacyGate, userId]);

  const gateMatchesCurrentUser = Boolean(userId && privacyGate.userId === userId);
  const matchingAuthorized = Boolean(
    authReady && logged && profileReady && candidate && gateMatchesCurrentUser &&
    privacyGate.status === "ready" && privacyGate.authorized,
  );
  // Perfil só é lido para personalização após confirmação do gate F-06.
  const matchingProfileComplete = matchingAuthorized && isD01Complete(profile, email);
  const matchingAvailable = matchingProfileComplete;
  const matchingState = !authReady
    ? "loading"
    : !logged
      ? "guest"
      : !profileReady
        ? "loading"
        : !candidate
          ? "not-candidate"
          : !gateMatchesCurrentUser || ["idle", "loading"].includes(privacyGate.status)
            ? "loading"
            : !matchingAuthorized
              ? "privacy"
              : !matchingProfileComplete
                ? "incomplete"
                : "ready";
  const matchingActive = matchingAvailable && urlFilters.sort === SORT_MATCH;
  const matchingActiveRef = useRef(matchingActive);
  matchingActiveRef.current = matchingActive;
  const displayedSort = matchingActive ? SORT_MATCH : urlFilters.sort === SORT_OLDEST ? SORT_OLDEST : SORT_RECENT;

  useEffect(() => {
    setQuery((current) => (current === urlQuery ? current : urlQuery));
  }, [urlQuery]);

  useEffect(() => {
    setPlaceDraft(urlFilters.place);
  }, [urlFilters.place]);

  useEffect(() => {
    setSalaryMinDraft(reaisInputFromCents(urlFilters.salaryMin));
    setSalaryMaxDraft(reaisInputFromCents(urlFilters.salaryMax));
  }, [urlFilters.salaryMin, urlFilters.salaryMax]);

  useEffect(() => {
    const trimmed = placeDraft.trim().slice(0, 80);
    if (trimmed === urlFilters.place) return undefined;
    const handle = setTimeout(() => {
      setSearchParams((current) => writeCatalogSearch(current, { place: trimmed }), { replace: true });
    }, 400);
    return () => clearTimeout(handle);
  }, [placeDraft, urlFilters.place, setSearchParams]);

  useEffect(() => {
    loadGenerationRef.current += 1;
    const currentParams = loadParamsRef.current;
    const { sort, ...requestParams } = currentParams;
    const requestSort = sort === SORT_OLDEST ? SORT_OLDEST : SORT_RECENT;
    paginationSortRef.current = requestSort;
    let cancelled = false;
    const peeked = peekApprovedJobsPage(currentParams);
    if (peeked) {
      setJobs(peeked.jobs);
      setResultCount(peeked.count);
      setCatalogStatus("ready");
    } else {
      setJobs([]);
      setResultCount(null);
      setCatalogStatus("loading");
    }
    setLoadingMore(false);

    loadApprovedJobs({ ...requestParams, sort: requestSort, offset: 0 })
      .then((page) => {
        if (cancelled) return;
        setJobs(page.jobs);
        setResultCount(page.count);
        setCatalogStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setCatalogStatus("error");
      });
    return () => { cancelled = true; };
  }, [loadFilterKey, reloadNonce]);

  useEffect(() => {
    if (urlFilters.sort !== SORT_MATCH || !authReady || matchingState === "loading" || matchingAvailable) return;
    setSearchParams((current) => writeCatalogSearch(current, { sort: SORT_RECENT }), { replace: true });
  }, [authReady, matchingAvailable, matchingState, setSearchParams, urlFilters.sort]);

  useEffect(() => {
    setPaginationWasUsed(false);
    setCatalogReorderAnnouncement("");
  }, [loadFilterKey, reloadNonce]);

  useEffect(() => {
    if (!matchingActive) setCatalogReorderAnnouncement("");
  }, [matchingActive]);

  const loadMore = async () => {
    if (loadingMore || catalogStatus !== "ready") return;
    if (resultCount != null && jobs.length >= resultCount) return;
    const generation = loadGenerationRef.current;
    const paramsAtClick = catalogFilterParams(loadParamsRef.current);
    const offset = jobs.length;
    setCatalogReorderAnnouncement("");
    setLoadingMore(true);
    try {
      const page = await loadApprovedJobs({
        ...paramsAtClick,
        sort: paginationSortRef.current,
        offset,
      });
      if (generation !== loadGenerationRef.current) return;
      const accumulated = mergeJobsById(jobs, page.jobs);
      setJobs(accumulated);
      if (matchingActiveRef.current) {
        setCatalogReorderAnnouncement(`Catálogo acumulado atualizado e reordenado por compatibilidade. ${accumulated.length} vagas nesta lista.`);
      }
      setPaginationWasUsed(true);
      setResultCount(page.count);
    } catch {
      /* mantém a lista já carregada */
    } finally {
      if (generation === loadGenerationRef.current) setLoadingMore(false);
    }
  };

  const replaceFilters = (patch) => {
    setSearchParams((current) => writeCatalogSearch(current, patch), { replace: true });
  };
  const toggle = (key, item, values) => {
    replaceFilters({ [key]: toggleFilterValue(item, values) });
  };
  const commitQueryToUrl = (nextQuery) => {
    const trimmed = String(nextQuery ?? "").trim();
    const current = searchParams.get("query") ?? "";
    if (trimmed === current) return;
    const next = new URLSearchParams(searchParams);
    if (trimmed) next.set("query", trimmed);
    else next.delete("query");
    setSearchParams(next, { replace: true });
  };
  const applyQuery = (nextQuery) => {
    setQuery(nextQuery);
    commitQueryToUrl(nextQuery);
  };
  const commitSalary = (event) => {
    const nextId = event?.relatedTarget?.id;
    if (nextId === "catalog-salary-min" || nextId === "catalog-salary-max") return;
    const min = centsFromReaisInput(salaryMinDraft);
    const max = centsFromReaisInput(salaryMaxDraft);
    if (min.error || max.error) {
      setSalaryError(min.error || max.error);
      return;
    }
    if (min.cents != null && max.cents != null && min.cents > max.cents) {
      setSalaryError("O mínimo não pode ser maior que o máximo.");
      return;
    }
    setSalaryError("");
    if (min.cents === urlFilters.salaryMin && max.cents === urlFilters.salaryMax) return;
    replaceFilters({ salaryMin: min.cents, salaryMax: max.cents });
  };
  const reset = () => {
    setQuery("");
    setPlaceDraft("");
    setSalaryMinDraft("");
    setSalaryMaxDraft("");
    setSalaryError("");
    setSearchParams(new URLSearchParams(), { replace: true });
  };
  const activeFilterCount =
    urlFilters.tech.length +
    urlFilters.level.length +
    urlFilters.workModel.length +
    (urlFilters.country ? 1 : 0) +
    (urlFilters.place ? 1 : 0) +
    (urlFilters.salaryMin != null || urlFilters.salaryMax != null ? 1 : 0);
  const initialCatalogLoading = catalogStatus === "loading" && jobs.length === 0;
  const displayedCount = resultCount ?? jobs.length;
  const hasMore = catalogStatus === "ready" && resultCount != null && jobs.length < resultCount;
  const catalogAnnouncement =
    initialCatalogLoading
      ? "Carregando vagas"
      : catalogStatus === "error"
        ? "Catálogo indisponível"
        : catalogStatus === "ready" && jobs.length === 0
          ? "Nenhuma vaga encontrada"
          : "";
  const retryCatalog = () => setReloadNonce((n) => n + 1);
  const displayedJobs = useMemo(
    () => matchingActive
      ? rankJobsByCompatibility(jobs, profile)
      : sortAccumulatedJobs(jobs, displayedSort),
    [displayedSort, jobs, matchingActive, profile],
  );
  const showPaginationControl = hasMore || paginationWasUsed;

  const standardHero = <section className="hero"><div className="shell hero-content"><div className="eyebrow"><Sparkles size={15}/> Vagas curadas pela comunidade</div><h1>Encontre o próximo passo<br/>da sua <em>carreira em tech.</em></h1><p>Oportunidades em empresas incríveis, selecionadas para quem quer construir o futuro.</p><form className="searchbox" role="search" aria-label="Buscar vagas no catálogo" onSubmit={(event) => { event.preventDefault(); commitQueryToUrl(query); }}><Search size={21} aria-hidden="true"/><input id="catalog-query" name="q" value={query} onChange={e => setQuery(e.target.value)} placeholder="Cargo, tecnologia ou empresa" aria-label="Cargo, tecnologia ou empresa"/><button className="primary" type="submit">Buscar vagas <ArrowUpRight size={17}/></button></form><div className="popular">Populares: <button type="button" onClick={() => applyQuery("React")}>React</button><button type="button" onClick={() => applyQuery("Node")}>Node.js</button><button type="button" onClick={() => applyQuery("Python")}>Python</button><button type="button" onClick={() => applyQuery("Designer")}>Product Design</button></div>    </div></section>;

  return <main id="conteudo" tabIndex={-1}>
    {standardHero}
    <div className="home-divider" aria-hidden="true">
      <svg className="home-divider__curve" viewBox="0 0 1440 120" preserveAspectRatio="none" focusable="false">
        <path fill="var(--color-surface)" stroke="none" d="M-8 52 C 180 118 380 14 560 64 C 740 112 920 8 1100 58 C 1240 96 1360 22 1448 48 L 1448 128 L -8 128 Z" />
      </svg>
      <ResponsiveAssetImage
        className="home-divider__avatar"
        src="/avatar-gdgjobs.png"
        sourceBase="/avatar-gdgjobs"
        sourceWidths={[480, 768]}
        sizes="(max-width: 760px) min(42vw, 148px), (max-width: 1024px) min(34vw, 220px), 280px"
        alt=""
        width={1169}
        height={987}
        loading="eager"
        decoding="async"
      />
    </div>
    <section className="shell jobs-layout">
      <FilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} resultCount={displayedCount} titleId="catalog-filters-title">
        <div className="filter-head">
          <h2 id="catalog-filters-title"><Filter size={18}/> Filtros</h2>
          <button type="button" onClick={reset}>Limpar</button>
        </div>
        <div className="filters__body">
          <FilterGroup name="catalog-tech" label="Tecnologias" values={CATALOG_TECHNOLOGIES} active={urlFilters.tech} toggle={(value) => toggle("tech", value, urlFilters.tech)} />
          <FilterGroup name="catalog-level" label="Nível de experiência" values={CATALOG_LEVELS} active={urlFilters.level} toggle={(value) => toggle("level", value, urlFilters.level)} />
          <FilterGroup name="catalog-work-model" label="Modelo de trabalho" values={CATALOG_WORK_MODELS} active={urlFilters.workModel} toggle={(value) => toggle("workModel", value, urlFilters.workModel)} />
          <StructuredFilters
            country={urlFilters.country}
            placeDraft={placeDraft}
            salaryMinDraft={salaryMinDraft}
            salaryMaxDraft={salaryMaxDraft}
            salaryError={salaryError}
            onCountry={(country) => replaceFilters({ country })}
            onPlace={setPlaceDraft}
            onSalaryMin={setSalaryMinDraft}
            onSalaryMax={setSalaryMaxDraft}
            onSalaryCommit={commitSalary}
          />
        </div>
      </FilterSheet>
      <div className="job-content">
        <div className="result-head">
          <div>
            <h2>Vagas em destaque</h2>
            <p className="catalog-result-count" aria-live="polite">
              {initialCatalogLoading ? (
                <span
                  className="admin-dashboard-skeleton-value catalog-result-count-skeleton"
                  aria-hidden="true"
                />
              ) : (
                `${displayedCount} oportunidades encontradas`
              )}
            </p>
          </div>
          <button className="filter-mobile" type="button" onClick={() => setFilterOpen(true)}><Filter size={16}/> Filtros {activeFilterCount > 0 && <b>{activeFilterCount}</b>}</button>
          <SortMenu
            value={displayedSort}
            matchAvailable={matchingAvailable}
            className={matchingAvailable ? "sort-wrap--matching" : ""}
            onChange={(sort) => replaceFilters({ sort })}
          />
        </div>
        {matchingState !== "not-candidate" ? (
          <MatchingFeature
            state={matchingState}
            active={matchingActive}
            onToggle={() => replaceFilters({ sort: matchingActive ? SORT_RECENT : SORT_MATCH })}
          />
        ) : null}
        <div className="cards">
          {catalogAnnouncement ? <p className="sr-only" role="status">{catalogAnnouncement}</p> : null}
          {catalogReorderAnnouncement ? <p className="sr-only" role="status" aria-live="polite">{catalogReorderAnnouncement}</p> : null}
          {initialCatalogLoading ? [1, 2, 3, 4].map((slot) => <article key={slot} className="job-card job-card--skeleton job-card--skeleton-static" aria-hidden="true" />) : null}
          {displayedJobs.map(job => <JobCard key={job.id} job={job} showMatchReasons={matchingActive} />)}
          {catalogStatus === "error" && jobs.length === 0 && (
            <div className="empty">
              <Search size={32} aria-hidden="true"/>
              <h3>Catálogo indisponível</h3>
              <p>Não foi possível carregar as vagas. Tente de novo em instantes.</p>
              <button className="outline" type="button" onClick={retryCatalog}>Tentar de novo</button>
            </div>
          )}
          {catalogStatus === "error" && jobs.length > 0 && (
            <p className="tiny" role="alert">
              Não foi possível atualizar o catálogo.{" "}
              <button className="outline" type="button" onClick={retryCatalog}>Tentar de novo</button>
            </p>
          )}
          {catalogStatus === "ready" && jobs.length === 0 && <div className="empty"><Search size={32} aria-hidden="true"/><h3>Nenhuma vaga encontrada</h3><p>Tente remover alguns filtros ou buscar outro termo.</p><button className="outline" type="button" onClick={reset}>Limpar filtros</button></div>}
        </div>
        {showPaginationControl ? (
          <div className="catalog-more">
            <button type="button" className="outline" onClick={loadMore} disabled={loadingMore || !hasMore}>
              {loadingMore ? "Carregando…" : hasMore ? "Carregar mais" : "Todas as vagas carregadas"}
            </button>
          </div>
        ) : null}
      </div>
    </section>
    {!logged && (
      <section className="cta"><div className="shell cta-inner"><div><div className="eyebrow light"><Users size={15}/> Seu perfil abre caminhos</div><h2>A vaga certa começa<br/>com um perfil que representa você.</h2><p>Crie seu perfil e apresente suas habilidades para oportunidades mais alinhadas.</p></div><Link to="/login" className="white-button">Criar perfil gratuito <ArrowUpRight size={17}/></Link></div></section>
    )}
  </main>;
}

function MatchingFeature({ state, active, onToggle }) {
  if (state === "loading") {
    return (
      <div className="catalog-match-feature catalog-match-feature--loading" aria-hidden="true">
        <span className="catalog-match-feature__icon" />
        <span className="catalog-match-feature__skeleton">
          <span />
          <span />
          <span />
        </span>
        <span className="catalog-match-feature__action-skeleton" />
      </div>
    );
  }

  const copy = state === "ready"
    ? {
        eyebrow: active ? "Sua lista personalizada" : "Recomendações do seu perfil",
        title: active ? "Estas vagas combinam com você" : "Encontre vagas que combinam com você",
        description: "Compare tecnologias, nível e modalidade. Os motivos mostram por que cada vaga combina com seu perfil.",
        action: active ? "Voltar à ordem recente" : "Ver vagas compatíveis",
      }
    : state === "privacy"
      ? {
          eyebrow: "Recomendações personalizadas",
          title: "Descubra vagas alinhadas ao seu perfil",
          description: "Escolha essa personalização em Privacidade para comparar tecnologias, nível e modalidade nas vagas.",
          action: "Configurar privacidade",
          href: "/preferencias",
        }
      : state === "incomplete"
        ? {
            eyebrow: "Recomendações personalizadas",
            title: "Complete seu perfil para encontrar vagas compatíveis",
            description: "Informe suas tecnologias, nível e modalidade para ativar a ordenação por afinidade.",
            action: "Completar perfil",
            href: "/perfil",
          }
        : {
            eyebrow: "Recomendações personalizadas",
            title: "Encontre vagas que combinam com você",
            description: "Entre para comparar seu perfil com as oportunidades e ver os motivos de compatibilidade.",
            action: "Entrar ou criar conta",
            href: "/login",
          };

  return (
    <section className={`catalog-match-feature catalog-match-feature--${state}${active ? " catalog-match-feature--active" : ""}`} aria-labelledby="catalog-match-title">
      <span className="catalog-match-feature__icon" aria-hidden="true"><Sparkles size={21} /></span>
      <div className="catalog-match-feature__copy">
        <span className="catalog-match-feature__eyebrow">{copy.eyebrow}</span>
        <h3 id="catalog-match-title">{copy.title}</h3>
        <p>{copy.description}</p>
      </div>
      {state === "ready" ? (
        <button className={active ? "outline catalog-match-feature__action" : "primary catalog-match-feature__action"} type="button" onClick={onToggle}>
          <Sparkles size={16} aria-hidden="true" /> {copy.action}
        </button>
      ) : (
        <Link className="outline catalog-match-feature__action" to={copy.href}>
          {copy.action} <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      )}
    </section>
  );
}

function SortMenu({ value, onChange, matchAvailable = false, className = "" }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const label = value === SORT_OLDEST
    ? "Mais antigas"
    : value === SORT_MATCH
      ? "Mais compatíveis nesta lista"
      : "Mais recentes";

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (next) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div className={[
      "sort-wrap",
      className,
    ].filter(Boolean).join(" ")} ref={rootRef}>
      <button
        type="button"
        className="sort"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="catalog-sort-menu"
        onClick={() => setOpen((current) => !current)}
      >
        {label} <ChevronDown size={16} />
      </button>
      {open && (
        <ul id="catalog-sort-menu" className="sort-menu" role="listbox" aria-label="Ordenar vagas">
          <li>
            <button type="button" role="option" aria-selected={value === SORT_RECENT} onClick={() => choose(SORT_RECENT)}>Mais recentes</button>
          </li>
          <li>
            <button type="button" role="option" aria-selected={value === SORT_OLDEST} onClick={() => choose(SORT_OLDEST)}>Mais antigas</button>
          </li>
          <li>
            <button type="button" role="option" aria-selected={value === SORT_MATCH} disabled={!matchAvailable} onClick={() => choose(SORT_MATCH)}>Mais compatíveis nesta lista</button>
          </li>
        </ul>
      )}
    </div>
  );
}

function StructuredFilters({
  country,
  placeDraft,
  salaryMinDraft,
  salaryMaxDraft,
  salaryError,
  onCountry,
  onPlace,
  onSalaryMin,
  onSalaryMax,
  onSalaryCommit,
}) {
  const describedBy = salaryError ? "catalog-salary-error catalog-salary-hint" : "catalog-salary-hint";
  const commitOnEnter = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onSalaryCommit();
    }
  };
  return (
    <>
      <div className="filter-group">
        <label className="filter-field" htmlFor="catalog-country">
          País
          <select id="catalog-country" name="country" value={country} onChange={(event) => onCountry(event.target.value)}>
            <option value="">Todos</option>
            {CATALOG_COUNTRIES.map((item) => (
              <option key={item.code} value={item.code}>{item.label}</option>
            ))}
          </select>
        </label>
        <p className="filter-hint">Com um país escolhido, vagas sem país ficam de fora.</p>
      </div>
      <div className="filter-group">
        <label className="filter-field" htmlFor="catalog-place">
          Localidade
          <input
            id="catalog-place"
            name="place"
            value={placeDraft}
            onChange={(event) => onPlace(event.target.value)}
            placeholder="Cidade ou região"
            autoComplete="off"
          />
        </label>
      </div>
      <fieldset className="filter-group">
        <legend>Faixa salarial (R$)</legend>
        <label className="filter-field" htmlFor="catalog-salary-min">
          Mínimo
          <input
            id="catalog-salary-min"
            name="salaryMin"
            inputMode="decimal"
            value={salaryMinDraft}
            onChange={(event) => onSalaryMin(event.target.value)}
            onBlur={onSalaryCommit}
            onKeyDown={commitOnEnter}
            aria-invalid={salaryError ? "true" : undefined}
            aria-describedby={describedBy}
          />
        </label>
        <label className="filter-field" htmlFor="catalog-salary-max">
          Máximo
          <input
            id="catalog-salary-max"
            name="salaryMax"
            inputMode="decimal"
            value={salaryMaxDraft}
            onChange={(event) => onSalaryMax(event.target.value)}
            onBlur={onSalaryCommit}
            onKeyDown={commitOnEnter}
            aria-invalid={salaryError ? "true" : undefined}
            aria-describedby={describedBy}
          />
        </label>
        {salaryError ? <p id="catalog-salary-error" className="filter-field__error" role="alert">{salaryError}</p> : null}
        <p id="catalog-salary-hint" className="filter-hint">Com a faixa preenchida, vagas A combinar ficam de fora.</p>
      </fieldset>
    </>
  );
}

function FilterGroup({ name, label, values, active, toggle }) {
  return (
    <div className="filter-group">
      <h3>{label}</h3>
      {values.map((value) => {
        const id = formOptionId(name, value);
        return (
          <label key={value} className="checkline">
            <input type="checkbox" id={id} name={name} value={value} checked={active.includes(value)} onChange={() => toggle(value)} />
            <span className="check"><Check size={13} /></span>
            {value}
          </label>
        );
      })}
    </div>
  );
}

function JobCard({ job, showMatchReasons = false }) {
  return (
    <Link className="job-card" to={`/jobs/${job.id}`} state={{ from: "/vagas" }}>
      <div className="company-logo" style={{ background: job.color }}>{job.logo}</div>
      <div className="job-main">
        <div className="job-title">
          <h3>{job.title}</h3>
          {job.featured && <span className="featured"><Sparkles size={13}/> Destaque</span>}
        </div>
        <p className="company-name">{job.company} <BadgeCheck size={15}/></p>
        <div className="meta">
          <span><MapPin size={15}/>{job.place}</span>
          <span><BriefcaseBusiness size={15}/>{job.type}</span>
          <span><CircleDollarSign size={15}/>{job.salary}</span>
        </div>
        <div className="tags">{(job.stack ?? []).map((t) => <span key={t}>{t}</span>)}</div>
        {showMatchReasons && job.matchReasons?.length ? (
          <div className="tags match-reasons" role="group" aria-label="Motivos de afinidade">
            {job.matchReasons.map((reason) => <span key={reason.key}>{reason.label}</span>)}
          </div>
        ) : null}
      </div>
      <div className="job-side">
        <span>{job.posted}</span>
        <span className="round-arrow" aria-hidden="true"><ArrowUpRight size={18}/></span>
      </div>
    </Link>
  );
}
