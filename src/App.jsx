import React, { useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { Header } from "./shared/ui/Header.jsx";
import { Footer } from "./shared/ui/Footer.jsx";
import { Home } from "./features/catalog/Home.jsx";
import { loadApprovedJob } from "./features/catalog/jobs-api.js";
import { JobDetail } from "./features/jobs/JobDetail.jsx";
import { Login } from "./features/auth/Login.jsx";
import { Onboarding } from "./features/auth/Onboarding.jsx";
import { loadAuthSnapshot, signOutUser, subscribeAuth } from "./features/auth/auth-api.js";
import { Admin } from "./Admin.jsx";

const EMPTY_AUTH = { session: null, profile: null, needsOnboarding: false };

export function App() {
  const [auth, setAuth] = useState(EMPTY_AUTH);

  useEffect(() => {
    let cancelled = false;
    loadAuthSnapshot()
      .then((snapshot) => {
        if (!cancelled) setAuth(snapshot);
      })
      .catch(() => {
        if (!cancelled) setAuth(EMPTY_AUTH);
      });
    const unsubscribe = subscribeAuth((snapshot) => {
      if (!cancelled) setAuth(snapshot);
    });
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
        <Route path="/jobs/:id" element={<CatalogGate auth={auth}><JobDetailRoute logged={Boolean(auth.session)} /></CatalogGate>} />
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

function JobDetailRoute({ logged }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [status, setStatus] = useState("loading");
  const [applicationSent, setApplicationSent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setJob(null);
    loadApprovedJob(id)
      .then((row) => {
        if (cancelled) return;
        setJob(row);
        setStatus(row ? "ready" : "missing");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => { cancelled = true; };
  }, [id]);

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
      onNeedLogin={() => navigate("/login")}
      applicationSent={applicationSent}
      setApplicationSent={setApplicationSent}
    />
  );
}
