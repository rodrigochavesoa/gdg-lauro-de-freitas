import React, { useEffect, useState } from "react";
import { BriefcaseBusiness, Search } from "lucide-react";
import { Link } from "react-router-dom";
import {
  applicationStatusLabel,
  canWithdrawStatus,
  formatApplicationDate,
  loadMyApplications,
  withdrawApplication,
} from "./apply-api.js";

export function MyApplications() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("loading");
  const [busyJobId, setBusyJobId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setError("");
    loadMyApplications()
      .then((list) => {
        if (cancelled) return;
        setRows(list);
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setRows([]);
        setError(err.message || "Não foi possível carregar suas candidaturas.");
        setStatus("error");
      });
    return () => { cancelled = true; };
  }, []);

  const withdraw = async (jobId) => {
    setBusyJobId(jobId);
    setError("");
    try {
      const updated = await withdrawApplication(jobId);
      setRows((current) =>
        current.map((row) => (row.jobId === jobId ? { ...row, status: updated?.status ?? "withdrawn" } : row)),
      );
    } catch (err) {
      setError(err.message || "Não é possível retirar esta candidatura.");
    } finally {
      setBusyJobId(null);
    }
  };

  return (
    <main className="detail-page">
      <div className="shell">
        <h1>Minhas candidaturas</h1>
        {error ? <p className="tiny" role="alert">{error}</p> : null}
        {status === "loading" ? (
          <div className="empty">
            <Search size={32} />
            <h3>Carregando candidaturas</h3>
            <p>Buscando as vagas em que você se candidatou.</p>
          </div>
        ) : null}
        {status === "ready" && rows.length === 0 ? (
          <div className="empty">
            <BriefcaseBusiness size={32} />
            <h3>Você ainda não se candidatou</h3>
            <p>Explore as vagas aprovadas e envie seu perfil em um clique.</p>
            <Link className="outline" to="/">Ver vagas</Link>
          </div>
        ) : null}
        {rows.length > 0 ? (
          <div className="cards">
            {rows.map((row) => (
              <article className="job-card" key={row.id || row.jobId}>
                <div className="job-main">
                  <div className="job-title">
                    <h3>
                      <Link to={`/jobs/${row.jobId}`}>{row.jobTitle || "Vaga"}</Link>
                    </h3>
                    <span className="featured">{applicationStatusLabel(row.status)}</span>
                  </div>
                  <p className="company-name">{row.companyName || "Empresa"}</p>
                  <div className="meta">
                    <span>{formatApplicationDate(row.updatedAt || row.createdAt)}</span>
                  </div>
                </div>
                <div className="job-side">
                  {canWithdrawStatus(row.status) ? (
                    <button
                      className="outline"
                      type="button"
                      disabled={busyJobId === row.jobId}
                      onClick={() => withdraw(row.jobId)}
                    >
                      {busyJobId === row.jobId ? "Retirando…" : "Retirar candidatura"}
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </main>
  );
}
