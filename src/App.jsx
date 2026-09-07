import React, { useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { Header } from "./shared/ui/Header.jsx";
import { Footer } from "./shared/ui/Footer.jsx";
import { Home } from "./features/catalog/Home.jsx";
import { loadApprovedJob } from "./features/catalog/jobs-api.js";
import { JobDetail } from "./features/jobs/JobDetail.jsx";
import { MyApplications } from "./features/jobs/MyApplications.jsx";
import { applyToJob, loadMyApplication, withdrawApplication } from "./features/jobs/apply-api.js";
import { Login } from "./features/auth/Login.jsx";
import { Onboarding } from "./features/auth/Onboarding.jsx";
import { loadAuthSnapshot, signOutUser, subscribeAuth } from "./features/auth/auth-api.js";
import { Admin } from "./Admin.jsx";

const EMPTY_AUTH = { session: null, profile: null, needsOnboarding: false };

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

  return (
    <>
      <Header
        logged={Boolean(auth.session)}
        displayName={auth.profile?.full_name}
        onSignOut={signOutUser}
      />
      <Routes>
        <Route path="/" element={<CatalogGate auth={auth}><Home /></CatalogGate>} />
        <Route path="/jobs/:id" element={<CatalogGate auth={auth}><JobDetailRoute logged={Boolean(auth.session)} userId={auth.session?.user?.id} needsOnboarding={auth.needsOnboarding} /></CatalogGate>} />
        <Route path="/minhas-candidaturas" element={<MyApplicationsRoute auth={auth} authReady={authReady} />} />
        <Route path="/onboarding" element={auth.needsOnboarding ? <OnboardingRoute auth={auth} setAuth={setAuth} /> : <Navigate to="/" replace />} />
        <Route path="/login" element={<LoginRoute auth={auth} />} />
        <Route path="/admin" element={<Admin />} />
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

function MyApplicationsRoute({ auth, authReady }) {
  if (!authReady) {
    return <main className="detail-page"><div className="shell"><p>Carregando…</p></div></main>;
  }
  if (!auth.session) return <Navigate to="/login" replace />;
  if (auth.needsOnboarding) return <Navigate to="/onboarding" replace />;
  return <MyApplications userId={auth.session.user.id} />;
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
  const [job, setJob] = useState(null);
  const [status, setStatus] = useState("loading");
  const [applicationStatus, setApplicationStatus] = useState(null);
  const [applicationLoading, setApplicationLoading] = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);
  const [applyError, setApplyError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setJob(null);
    setApplicationStatus(null);
    setApplicationLoading(Boolean(logged));
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
      })
      .catch(() => {
        if (cancelled) return;
        setApplicationStatus(null);
        setApplicationLoading(false);
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
    return <main className="detail-page"><div className="shell"><p>Carregando vaga…</p></div></main>;
  }
  if (status !== "ready") {
    return <main className="detail-page"><div className="shell"><p>Vaga não encontrada ou indisponível.</p><button className="back" onClick={() => navigate("/")}>Voltar para vagas</button></div></main>;
  }
  return (
    <JobDetail
      job={job}
      goBack={() => navigate("/")}
      logged={logged}
      needsOnboarding={needsOnboarding}
      onNeedLogin={() => navigate("/login")}
      onNeedOnboarding={() => navigate("/onboarding")}
      applicationStatus={applicationStatus}
      applicationLoading={applicationLoading}
      onApply={() => runApplyAction(() => applyToJob(id))}
      onWithdraw={() => runApplyAction(() => withdrawApplication(id))}
      applyBusy={applyBusy}
      applyError={applyError}
    />
  );
}
