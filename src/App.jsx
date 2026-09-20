import React, { useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { Header } from "./shared/ui/Header.jsx";
import { Footer } from "./shared/ui/Footer.jsx";
import { ScrollToTop } from "./shared/ui/ScrollToTop.jsx";
import { SkipLink } from "./shared/ui/SkipLink.jsx";
import { Home } from "./features/catalog/Home.jsx";
import { Portal } from "./features/portal/Portal.jsx";
import { EventosIndex } from "./features/events/Eventos.jsx";
import { EventLanding } from "./features/events/EventLanding.jsx";
import { findEventBySlug } from "./features/events/events-catalog.js";
import { Newsletter } from "./features/newsletter/Newsletter.jsx";
import { findApprovedJobInCache, loadApprovedJob, loadApprovedJobs } from "./features/catalog/jobs-api.js";
import { JobDetail, JobDetailSkeleton } from "./features/jobs/JobDetail.jsx";
import { jobDetailBackFrom, jobDetailBackLabel } from "./features/jobs/job-detail-nav.js";
import { MyApplications } from "./features/jobs/MyApplications.jsx";
import { applyToJob, loadMyApplication, loadMyApplications, withdrawApplication } from "./features/jobs/apply-api.js";
import { Login } from "./features/auth/Login.jsx";
import { Onboarding } from "./features/auth/Onboarding.jsx";
import {
  avatarPublicUrl,
  invalidateAvatarSignedUrl,
  isAvatarUploadEnabled,
  loadAuthSnapshot,
  mergeAuthSnapshot,
  resolveHeaderIdentity,
  saveProfileAvatar,
  signOutUser,
  subscribeAuth,
} from "./features/auth/auth-api.js";
import { isCandidateProfile, isD01Complete, canUseCandidateApply, isCandidateApplySurfaceReady, shouldLoadMyApplication } from "./features/auth/profile-completeness.js";
import { Admin } from "./Admin.jsx";
import { adminChildRoutes } from "./features/admin/admin-routes.jsx";
import { PrivacyPreferences } from "./features/privacy/PrivacyPreferences.jsx";
import { loadPrivacyPreferences } from "./features/privacy/privacy-api.js";

const EMPTY_AUTH = { session: null, profile: null, needsOnboarding: false };
const STAFF_ROLES = new Set(["admin", "curator", "moderator"]);

export function App() {
  const [auth, setAuth] = useState(EMPTY_AUTH);
  const [authReady, setAuthReady] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarPath, setAvatarPath] = useState(null);
  const [avatarStatus, setAvatarStatus] = useState("idle");
  const authGeneration = useRef(0);
  const lastUserId = useRef(null);
  const sessionUserId = useRef(null);
  const avatarRequestKey = useRef(null);
  sessionUserId.current = auth.session?.user?.id ?? null;
  const userId = auth.session?.user?.id ?? null;
  const profileReady = Boolean(auth.profile);
  const storedAvatarPath = auth.profile?.avatar_path ?? null;

  useEffect(() => {
    let cancelled = false;
    const bootEpoch = authGeneration.current;
    const applySnapshot = (snapshot, requestEpoch = authGeneration.current) => {
      if (cancelled) return;
      setAuth((current) => {
        if (requestEpoch !== authGeneration.current) return current;
        return mergeAuthSnapshot(current, snapshot);
      });
      if (requestEpoch === authGeneration.current) setAuthReady(true);
    };
    loadAuthSnapshot()
      .then((snapshot) => applySnapshot(snapshot, bootEpoch))
      .catch(() => {
        applySnapshot(EMPTY_AUTH, bootEpoch);
      });
    const unsubscribe = subscribeAuth((snapshot) => applySnapshot(snapshot));
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (lastUserId.current !== userId) {
      if (lastUserId.current != null || userId == null) {
        authGeneration.current += 1;
      }
      lastUserId.current = userId;
      avatarRequestKey.current = null;
    }
  }, [userId]);

  useEffect(() => {
    const epoch = authGeneration.current;
    if (!userId) {
      avatarRequestKey.current = null;
      setAvatarUrl(null);
      setAvatarPath(null);
      setAvatarStatus("idle");
      return undefined;
    }
    if (!profileReady) {
      setAvatarStatus("loading");
      return undefined;
    }
    if (!storedAvatarPath) {
      avatarRequestKey.current = `${userId}:`;
      setAvatarUrl(null);
      setAvatarPath(null);
      setAvatarStatus("ready");
      return undefined;
    }
    const key = `${userId}:${storedAvatarPath}`;
    if (avatarRequestKey.current === key) {
      return undefined;
    }
    setAvatarStatus("loading");
    let cancelled = false;
    avatarPublicUrl(storedAvatarPath, { userId })
      .then((url) => {
        if (cancelled || epoch !== authGeneration.current) return;
        avatarRequestKey.current = key;
        setAvatarUrl(url);
        setAvatarPath(storedAvatarPath);
        setAvatarStatus("ready");
      })
      .catch(() => {
        if (cancelled || epoch !== authGeneration.current) return;
        avatarRequestKey.current = key;
        setAvatarUrl(null);
        setAvatarPath(storedAvatarPath);
        setAvatarStatus("ready");
      });
    return () => {
      cancelled = true;
    };
  }, [userId, profileReady, storedAvatarPath]);

  const handleSignOut = async () => {
    authGeneration.current += 1;
    lastUserId.current = null;
    avatarRequestKey.current = null;
    invalidateAvatarSignedUrl();
    setAuth(EMPTY_AUTH);
    setAvatarUrl(null);
    setAvatarPath(null);
    setAvatarStatus("idle");
    try {
      await signOutUser();
    } finally {
      setAuth(EMPTY_AUTH);
    }
  };

  const identity = resolveHeaderIdentity({
    session: auth.session,
    profile: auth.profile,
    avatarUrl,
    avatarPath,
    avatarStatus,
  });

  // UX-PERF-05 — warm catalog on shell mount so /login → / avoids cold skeleton scroll jank
  useEffect(() => {
    loadApprovedJobs().catch(() => {});
  }, []);

  // UX-PERF-06 / UX-PERF-07 — warm minhas candidaturas e privacidade (dedupe via inflight/TTL)
  useEffect(() => {
    const role = auth.profile?.role;
    if (!userId || !role || STAFF_ROLES.has(role)) return undefined;
    loadMyApplications({ userId }).catch(() => {});
    if (!auth.needsOnboarding) {
      loadPrivacyPreferences({ userId }).catch(() => {});
    }
    return undefined;
  }, [userId, auth.profile?.role, auth.needsOnboarding]);

  return (
    <>
      <ScrollToTop />
      <SkipLink />
      <Header
        logged={Boolean(auth.session)}
        displayName={identity.displayName}
        email={auth.session?.user?.email || ""}
        role={auth.profile?.role}
        avatarUrl={identity.avatarUrl}
        identityPending={identity.pending}
        needsOnboarding={auth.needsOnboarding}
        authReady={authReady}
        onSignOut={handleSignOut}
        onSaveAvatar={
          isAvatarUploadEnabled()
            ? async (blob) => {
                const epoch = authGeneration.current;
                const currentUserId = sessionUserId.current;
                const profile = await saveProfileAvatar(blob);
                if (epoch !== authGeneration.current) return;
                invalidateAvatarSignedUrl(currentUserId);
                const key = currentUserId && profile.avatar_path
                  ? `${currentUserId}:${profile.avatar_path}`
                  : null;
                if (key) avatarRequestKey.current = key;
                setAvatarPath(profile.avatar_path);
                setAuth((current) => (current.session ? { ...current, profile } : current));
                try {
                  const url = await avatarPublicUrl(profile.avatar_path, { userId: currentUserId });
                  if (epoch !== authGeneration.current) return;
                  setAvatarUrl(url);
                  setAvatarPath(profile.avatar_path);
                  setAvatarStatus("ready");
                } catch {
                  if (epoch !== authGeneration.current) return;
                  setAvatarUrl(null);
                  setAvatarPath(profile.avatar_path);
                  setAvatarStatus("ready");
                }
              }
            : undefined
        }
      />
      <Routes>
        <Route path="/" element={<CatalogGate auth={auth}><Portal logged={Boolean(auth.session)} profile={auth.profile} email={auth.session?.user?.email} /></CatalogGate>} />
        <Route path="/vagas" element={<CatalogGate auth={auth}><Home logged={Boolean(auth.session)} /></CatalogGate>} />
        <Route path="/eventos" element={<CatalogGate auth={auth}><EventosIndex logged={Boolean(auth.session)} /></CatalogGate>} />
        <Route path="/eventos/:slug" element={<CatalogGate auth={auth}><EventLandingRoute /></CatalogGate>} />
        <Route path="/newsletter" element={<CatalogGate auth={auth}><Newsletter logged={Boolean(auth.session)} /></CatalogGate>} />
        <Route path="/jobs/:id" element={<CatalogGate auth={auth}><JobDetailRoute logged={Boolean(auth.session)} userId={auth.session?.user?.id} needsOnboarding={auth.needsOnboarding} authReady={authReady} profile={auth.profile} /></CatalogGate>} />
        <Route path="/minhas-candidaturas" element={<MyApplicationsRoute auth={auth} authReady={authReady} />} />
        <Route path="/preferencias" element={<PrivacyPreferencesRoute auth={auth} authReady={authReady} />} />
        <Route path="/perfil" element={<ProfileEditRoute auth={auth} authReady={authReady} setAuth={setAuth} />} />
        <Route path="/onboarding" element={auth.needsOnboarding ? <OnboardingRoute auth={auth} setAuth={setAuth} sessionUserId={sessionUserId} /> : <Navigate to="/" replace />} />
        <Route path="/login" element={<LoginRoute auth={auth} />} />
        <Route path="/admin" element={<Admin session={auth.session} authProfile={auth.profile} authReady={authReady} />}>
          {adminChildRoutes}
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Footer />
    </>
  );
}

function CatalogGate({ auth, children }) {
  if (auth.needsOnboarding) return <Navigate to="/onboarding" replace />;
  return children;
}

function EventLandingRoute() {
  const { slug } = useParams();
  const event = findEventBySlug(slug);
  if (!event) return <Navigate to="/eventos" replace />;
  return <EventLanding event={event} />;
}

function MyApplicationsRoute({ auth, authReady }) {
  if (auth.needsOnboarding) return <Navigate to="/onboarding" replace />;
  if (auth.session) return <MyApplications userId={auth.session.user.id} />;
  if (!authReady) return <MyApplications />;
  return <Navigate to="/login" replace />;
}

function LoginRoute({ auth }) {
  if (auth.needsOnboarding) return <Navigate to="/onboarding" replace />;
  if (auth.session) return <Navigate to="/" replace />;
  return <Login />;
}

function PrivacyPreferencesRoute({ auth, authReady }) {
  if (auth.needsOnboarding) return <Navigate to="/onboarding" replace />;
  if (auth.session) return <PrivacyPreferences userId={auth.session.user.id} />;
  if (!authReady) return <PrivacyPreferences />;
  return <Navigate to="/login" replace />;
}

function ProfileEditPending() {
  return (
    <main id="conteudo" tabIndex={-1} className="admin-page">
      <div className="shell admin-shell">
        <section className="admin-content" aria-busy="true">
          <div className="admin-title">
            <div>
              <span className="eyebrow">Perfil</span>
              <h1>Editar perfil</h1>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function ProfileEditRoute({ auth, authReady, setAuth }) {
  const editingUserId = auth.session?.user?.id;
  if (auth.needsOnboarding) return <Navigate to="/onboarding" replace />;
  if (auth.session) {
    if (auth.profile?.role && STAFF_ROLES.has(auth.profile.role)) {
      return <Navigate to="/" replace />;
    }
    if (!auth.profile) return <ProfileEditPending />;
    return (
      <Onboarding
        mode="edit"
        profile={auth.profile}
        email={auth.session.user.email}
        onSaved={(profile) => {
          setAuth((current) => {
            if (current.session?.user?.id !== editingUserId) return current;
            return {
              ...current,
              profile,
              needsOnboarding: isCandidateProfile(profile) && !isD01Complete(profile, current.session.user.email),
            };
          });
        }}
      />
    );
  }
  if (!authReady) return <ProfileEditPending />;
  return <Navigate to="/login" replace />;
}

function OnboardingRoute({ auth, setAuth, sessionUserId }) {
  const navigate = useNavigate();
  const editingUserId = auth.session?.user?.id;
  return (
    <Onboarding
      profile={auth.profile}
      email={auth.session?.user?.email}
      onSaved={(profile) => {
        if (!editingUserId || sessionUserId.current !== editingUserId) return;
        setAuth((current) => {
          if (current.session?.user?.id !== editingUserId) return current;
          return { ...current, profile, needsOnboarding: false };
        });
        if (sessionUserId.current !== editingUserId) return;
        navigate("/", { replace: true });
      }}
    />
  );
}

function JobDetailRoute({ logged, userId, needsOnboarding, authReady, profile }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const from = jobDetailBackFrom(state?.from);
  const backLabel = jobDetailBackLabel(from);
  const goBack = () => navigate(from);
  const [job, setJob] = useState(null);
  const [status, setStatus] = useState("loading");
  const [applicationStatus, setApplicationStatus] = useState(null);
  const [applicationLoading, setApplicationLoading] = useState(false);
  const [applicationCheckFailed, setApplicationCheckFailed] = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);
  const [applyError, setApplyError] = useState("");
  const applySurfaceReady = isCandidateApplySurfaceReady({ authReady, logged, profile });
  const candidateApply = canUseCandidateApply({ authReady, logged, profile });
  const loadOwnApplication = shouldLoadMyApplication({ authReady, logged, profile });

  useEffect(() => {
    let cancelled = false;
    const cached = findApprovedJobInCache(id);
    if (cached) {
      setJob(cached);
      setStatus("partial");
    } else {
      setJob(null);
      setStatus("loading");
    }
    setApplicationStatus(null);
    setApplicationLoading(loadOwnApplication);
    setApplicationCheckFailed(false);
    setApplyError("");

    const jobPromise = loadApprovedJob(id);
    const applicationPromise = loadOwnApplication
      ? loadMyApplication(id, userId)
      : Promise.resolve(null);

    jobPromise
      .then((row) => {
        if (cancelled) return;
        setJob(row);
        setStatus(row ? "ready" : "missing");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    applicationPromise
      .then((row) => {
        if (cancelled) return;
        setApplicationStatus(row?.status ?? null);
        setApplicationLoading(false);
        setApplicationCheckFailed(false);
      })
      .catch(() => {
        if (cancelled) return;
        setApplicationStatus(null);
        setApplicationLoading(false);
        setApplicationCheckFailed(true);
      });

    return () => { cancelled = true; };
  }, [id, logged, userId, loadOwnApplication]);

  const runApplyAction = async (action) => {
    if (!logged || !candidateApply) return;
    setApplyBusy(true);
    setApplyError("");
    try {
      const row = await action();
      setApplicationStatus(row?.status ?? null);
    } catch (error) {
      if (error.code === "already applied") {
        const existing = await loadMyApplication(id, userId).catch(() => null);
        setApplicationStatus(existing?.status ?? "submitted");
        setApplyError("");
        return;
      }
      if (error.code === "profile incomplete") {
        navigate("/onboarding");
        return;
      }
      if (error.code === "authentication required") {
        navigate("/login");
        return;
      }
      setApplyError(error.message || "Não foi possível concluir a candidatura.");
    } finally {
      setApplyBusy(false);
    }
  };

  if (status === "loading") {
    return <JobDetailSkeleton goBack={goBack} backLabel={backLabel} />;
  }
  if (status === "missing" || status === "error") {
    return <main id="conteudo" tabIndex={-1} className="detail-page"><div className="shell"><p role="status">Vaga não encontrada ou indisponível.</p><button className="back" type="button" onClick={goBack}>{backLabel}</button></div></main>;
  }
  if (status === "partial" || status === "ready") {
    return (
      <JobDetail
        job={job}
        isPartial={status === "partial"}
        goBack={goBack}
        backLabel={backLabel}
        logged={logged}
        needsOnboarding={needsOnboarding}
        canUseCandidateApply={candidateApply}
        applySurfaceReady={applySurfaceReady}
        onNeedLogin={() => navigate("/login")}
        onNeedOnboarding={() => navigate("/onboarding")}
        applicationStatus={applicationStatus}
        applicationLoading={applicationLoading}
        applicationCheckFailed={applicationCheckFailed}
        onApply={() => runApplyAction(() => applyToJob(id))}
        onWithdraw={() => runApplyAction(() => withdrawApplication(id))}
        applyBusy={applyBusy}
        applyError={applyError}
      />
    );
  }
  return null;
}
