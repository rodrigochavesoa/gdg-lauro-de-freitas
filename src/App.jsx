import React, { useState } from "react";
import { Header } from "./shared/ui/Header.jsx";
import { Footer } from "./shared/ui/Footer.jsx";
import { Home } from "./features/catalog/Home.jsx";
import { JobDetail } from "./features/jobs/JobDetail.jsx";
import { Login } from "./features/auth/Login.jsx";
import { Admin } from "./Admin.jsx";

export function App() {
  const [page, setPage] = useState("home");
  const [selectedJob, setSelectedJob] = useState(null);
  const [logged, setLogged] = useState(false);
  const [applicationSent, setApplicationSent] = useState(false);

  const openJob = (job) => {
    setSelectedJob(job);
    setApplicationSent(false);
    setPage("detail");
    window.scrollTo(0, 0);
  };

  return (
    <>
      <Header page={page} setPage={setPage} logged={logged} setLogged={setLogged} />
      {page === "home" && <Home onOpenJob={openJob} />}
      {page === "detail" && selectedJob && (
        <JobDetail
          job={selectedJob}
          goBack={() => setPage("home")}
          logged={logged}
          setLogged={setLogged}
          applicationSent={applicationSent}
          setApplicationSent={setApplicationSent}
        />
      )}
      {page === "admin" && <Admin setLogged={setLogged} />}
      {page === "login" && (
        <Login
          onLogin={() => {
            setLogged(true);
            setPage("home");
          }}
        />
      )}
      <Footer />
    </>
  );
}
