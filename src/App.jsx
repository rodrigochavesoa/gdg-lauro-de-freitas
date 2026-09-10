import React, { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { Header } from "./shared/ui/Header.jsx";
import { Footer } from "./shared/ui/Footer.jsx";
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
import { loadAuthSnapshot, signOutUser, subscribeAuth } from "./features/auth/auth-api.js";
import { Admin } from "./Admin.jsx";

const EMPTY_AUTH = { session: null, profile: null, needsOnboarding: false };
const STAFF_ROLES = new Set(["admin", "curator", "moderator"]);

export function App() {
  const [auth, setAuth] = useState(EMPTY_AUTH);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const applySnapshot = (snapshot) => {
      if (cancelled) return;
      setAuth(snapshot);
      setAuthReady(true);
    };
    loadAuthSnapshot()
      .then(applySnapshot)
      .catch(() => {
        applySnapshot(EMPTY_AUTH);
      });
    const unsubscribe = subscribeAuth(applySnapshot);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  // UX-PERF-05 — warm catalog on shell mount so /login → / avoids cold skeleton scroll jank
  useEffect(() => {
    loadApprovedJobs().catch(() => {});
  }, []);

  // UX-PERF-06 — warm minhas candidaturas for candidate sessions (dedupe via inflight/TTL)
  useEffect(() => {
    const userId = auth.session?.user?.id;
    const role = auth.profile?.role;
    if (!userId || !role || STAFF_ROLES.has(role)) return undefined;
    loadMyApplications({ userId }).catch(() => {});
    return undefined;
  }, [auth.session?.user?.id, auth.profile?.role]);

  return (
    <>
      <Header
        logged={Boolean(auth.session)}
        displayName={auth.profile?.full_name}
        role={auth.profile?.role}
        onSignOut={signOutUser}
      />
      <Routes>
        <Route path="/" element={<CatalogGate auth={auth}><Portal logged={Boolean(auth.session)} profile={auth.profile} email={auth.session?.user?.email} /></CatalogGate>} />
        <Route path="/vagas" element={<CatalogGate auth={auth}><Home logged={Boolean(auth.session)} /></CatalogGate>} />
        <Route path="/eventos" element={<CatalogGate auth={auth}><EventosIndex logged={Boolean(auth.session)} /></CatalogGate>} />
        <Route path="/eventos/:slug" element={<CatalogGate auth={auth}><EventLandingRoute /></CatalogGate>} />
        <Route path="/newsletter" element={<CatalogGate auth={auth}><Newsletter logged={Boolean(auth.session)} /></CatalogGate>} />
        <Route path="/jobs/:id" element={<CatalogGate auth={auth}><JobDetailRoute logged={Boolean(auth.session)} userId={auth.session?.user?.id} needsOnboarding={auth.needsOnboarding} /></CatalogGate>} />
        <Route path="/minhas-candidaturas" element={<MyApplicationsRoute auth={auth} authReady={authReady} />} />
        <Route path="/onboarding" element={auth.needsOnboarding ? <OnboardingRoute auth={auth} setAuth={setAuth} /> : <Navigate to="/" replace />} />
        <Route path="/login" element={<LoginRoute auth={auth} />} />
        <Route path="/admin" element={<Admin session={auth.session} authProfile={auth.profile} authReady={authReady} />} />
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

function OnboardingRoute({ auth, setAuth }) {
  const navigate = useNavigate();
  return (
    <Onboarding
      profile={auth.profile}
      email={auth.session?.user?.email}
      onSaved={(profile) => {
        setAuth((current) => ({ ...current, profile, needsOnboarding: false }));
        navigate("/", { replace: true });
      }}
    />
  );
}

function JobDetailRoute({ logged, userId, needsOnboarding }) {
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
    setApplicationLoading(Boolean(logged));
    setApplicationCheckFailed(false);
    setApplyError("");

    const jobPromise = loadApprovedJob(id);
    const applicationPromise = logged
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
  }, [id, logged, userId]);

  const runApplyAction = async (action) => {
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
    return <main className="detail-page"><div className="shell"><p>Vaga não encontrada ou indisponível.</p><button className="back" onClick={goBack}>{backLabel}</button></div></main>;
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
