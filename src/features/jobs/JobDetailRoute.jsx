import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { findApprovedJobInCache, loadApprovedJob } from "../catalog/jobs-api.js";
import { applyToJob, loadMyApplication, withdrawApplication } from "./apply-api.js";
import { JobDetail, JobDetailSkeleton } from "./JobDetail.jsx";
import { jobDetailBackFrom, jobDetailBackLabel } from "./job-detail-nav.js";
import { canUseCandidateApply, isCandidateApplySurfaceReady, shouldLoadMyApplication } from "../auth/profile-completeness.js";

export function JobDetailRoute({ logged, userId, needsOnboarding, authReady, profile }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const from = jobDetailBackFrom(state?.from);
  const backLabel = jobDetailBackLabel(from);
  const goBack = () => navigate(from);
  const [job, setJob] = useState(null);
  const [status, setStatus] = useState("loading");
  const [loadError, setLoadError] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [applicationStatus, setApplicationStatus] = useState(null);
  const [applicationLoading, setApplicationLoading] = useState(false);
  const [applicationCheckFailed, setApplicationCheckFailed] = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);
  const [applyError, setApplyError] = useState("");
  const applySurfaceReady = isCandidateApplySurfaceReady({ authReady, logged, profile });
  const candidateApply = canUseCandidateApply({ authReady, logged, profile });
  const loadOwnApplication = shouldLoadMyApplication({ authReady, logged, profile });
  const routeIdRef = useRef(id);
  routeIdRef.current = id;

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
    setApplyBusy(false);
    setLoadError(false);

    const jobPromise = loadApprovedJob(id);
    const applicationPromise = loadOwnApplication
      ? loadMyApplication(id, userId)
      : Promise.resolve(null);

    jobPromise
      .then((row) => {
        if (cancelled) return;
        setLoadError(false);
        setJob(row);
        setStatus(row ? "ready" : "missing");
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
        if (cached) {
          setJob(cached);
          setStatus("partial");
          return;
        }
        setJob(null);
        setStatus("error");
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
  }, [id, logged, userId, loadOwnApplication, reloadNonce]);

  const runApplyAction = async (action) => {
    if (!logged || !candidateApply) return;
    const clickedId = id;
    setApplyBusy(true);
    setApplyError("");
    try {
      const row = await action();
      if (routeIdRef.current !== clickedId) return;
      setApplicationStatus(row?.status ?? null);
    } catch (error) {
      if (routeIdRef.current !== clickedId) return;
      if (error.code === "already applied") {
        const existing = await loadMyApplication(clickedId, userId).catch(() => null);
        if (routeIdRef.current !== clickedId) return;
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
      if (routeIdRef.current === clickedId) setApplyBusy(false);
    }
  };

  if (status === "loading") {
    return <JobDetailSkeleton goBack={goBack} backLabel={backLabel} />;
  }
  if (status === "missing") {
    return (
      <main id="conteudo" tabIndex={-1} className="detail-page">
        <div className="shell">
          <p role="status">Vaga não encontrada.</p>
          <button className="back" type="button" onClick={goBack}>{backLabel}</button>
        </div>
      </main>
    );
  }
  if (status === "error") {
    return (
      <main id="conteudo" tabIndex={-1} className="detail-page">
        <div className="shell">
          <p role="alert">Não foi possível carregar esta vaga. Tente de novo em instantes.</p>
          <button className="outline" type="button" onClick={() => setReloadNonce((n) => n + 1)}>
            Tentar de novo
          </button>
          <button className="back" type="button" onClick={goBack}>{backLabel}</button>
        </div>
      </main>
    );
  }
  if (status === "partial" || status === "ready") {
    return (
      <JobDetail
        job={job}
        isPartial={status === "partial"}
        loadError={loadError}
        onRetryLoad={() => setReloadNonce((n) => n + 1)}
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
