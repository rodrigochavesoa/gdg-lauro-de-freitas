import React, { useEffect, useState } from "react";
import { Header } from "./shared/ui/Header.jsx";
import { Footer } from "./shared/ui/Footer.jsx";
import { Home } from "./features/catalog/Home.jsx";
import { JobDetail } from "./features/jobs/JobDetail.jsx";
import { Login } from "./features/auth/Login.jsx";
import { Onboarding } from "./features/auth/Onboarding.jsx";
import { loadAuthSnapshot, signOutUser, subscribeAuth } from "./features/auth/auth-api.js";
import { Admin } from "./Admin.jsx";

export function App() {
  const [page, setPage] = useState("home");
  const [selectedJob, setSelectedJob] = useState(null);
  const [applicationSent, setApplicationSent] = useState(false);
  const [auth, setAuth] = useState({ session: null, profile: null, needsOnboarding: false });

  useEffect(() => {
    let cancelled = false;
    loadAuthSnapshot()
      .then((snapshot) => {
        if (!cancelled) setAuth(snapshot);
      })
      .catch(() => {
        if (!cancelled) setAuth({ session: null, profile: null, needsOnboarding: false });
      });
    const unsubscribe = subscribeAuth((snapshot) => {
      if (!cancelled) setAuth(snapshot);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const logged = Boolean(auth.session);
  useEffect(() => {
    if (logged && page === "login" && !auth.needsOnboarding) {
      setPage("home");
    }
  }, [logged, page, auth.needsOnboarding]);

  const openJob = (job) => {
    setSelectedJob(job);
    setApplicationSent(false);
    setPage("detail");
    window.scrollTo(0, 0);
  };

  return (
    <>
      <Header
        page={page}
        setPage={setPage}
        logged={logged}
        displayName={auth.profile?.full_name}
        onSignOut={signOutUser}
      />
      {auth.needsOnboarding && page !== "admin" ? (
        <Onboarding
          profile={auth.profile}
          email={auth.session?.user?.email}
          onSaved={(profile) => setAuth((current) => ({ ...current, profile, needsOnboarding: false }))}
        />
      ) : (
        <>
          {page === "home" && <Home onOpenJob={openJob} />}
          {page === "detail" && selectedJob && (
            <JobDetail
              job={selectedJob}
              goBack={() => setPage("home")}
              logged={logged}
              onNeedLogin={() => setPage("login")}
              applicationSent={applicationSent}
              setApplicationSent={setApplicationSent}
            />
          )}
          {page === "admin" && <Admin />}
          {page === "login" && !logged && <Login />}
        </>
      )}
      <Footer />
    </>
  );
}
