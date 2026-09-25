import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, ListChecks } from "lucide-react";
import {
  loadCurationJobDetail,
  loadCurationQueue,
  peekCurationQueueCache,
  resubmitJobForCuration,
  setJobCurationPriority,
  submitCurationReview,
  subscribeCurationJobs,
} from "./curation-api.js";
import { mergeCurationQueue } from "./curation-queue.js";
import { RUBRIC_OPTIONS } from "./rubric.js";
import { CurationTimeline } from "./CurationTimeline.jsx";
import { AutoResizeTextarea, TEXTAREA_LIMITS } from "../../shared/ui/AutoResizeTextarea.jsx";
import { CurationPriorityControls } from "./CurationPriorityControls.jsx";

const LEVEL_LABEL = {
  intern: "Estágio",
  junior: "Júnior",
  mid: "Pleno",
  senior: "Sênior",
};

const MODEL_LABEL = {
  remote: "Remoto",
  hybrid: "Híbrido",
  onsite: "Presencial",
};

function mergeById(current, incoming) {
  const seen = new Set(current.map((row) => String(row.id)));
  return [...current, ...incoming.filter((row) => !seen.has(String(row.id)))];
}

/** Sem id explícito, não abre detalhe. Id que saiu da lista não cai na próxima vaga. */
function resolveCurationSelection(visibleJobs, selectedId) {
  if (!selectedId) return null;
  return visibleJobs.find((job) => job.id === selectedId) ?? null;
}

export function CurationQueue({ profile, includeRejected = false }) {
  const isAdmin = profile.role === "admin";
  const cached = peekCurationQueueCache({ scope: "pending", page: 1 });
  const [queue, setQueue] = useState(() => cached?.queue ?? []);
  const [rejected, setRejected] = useState([]);
  const [pendingHasNext, setPendingHasNext] = useState(() => Boolean(cached?.hasNext));
  const [rejectedHasNext, setRejectedHasNext] = useState(false);
  const [pendingPage, setPendingPage] = useState(1);
  const [rejectedPage, setRejectedPage] = useState(1);
  const [rejectedStatus, setRejectedStatus] = useState("idle");
  const [selectedId, setSelectedId] = useState("");
  const [decision, setDecision] = useState("approve");
  const [rubricCode, setRubricCode] = useState("");
  const [comment, setComment] = useState("");
  const [priorityReason, setPriorityReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(() => !cached);
  const [pendingLoadingMore, setPendingLoadingMore] = useState(false);
  const [rejectedLoadingMore, setRejectedLoadingMore] = useState(false);
  const [view, setView] = useState("pending");
  const [detailOpen, setDetailOpen] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [detailEpoch, setDetailEpoch] = useState(0);
  const [detailJobId, setDetailJobId] = useState("");
  const [detailStatus, setDetailStatus] = useState("idle");
  const [detailError, setDetailError] = useState("");
  const [detailDescription, setDetailDescription] = useState("");
  const [detailStack, setDetailStack] = useState([]);
  const [detailReviews, setDetailReviews] = useState([]);
  const pendingGenerationRef = useRef(0);
  const rejectedGenerationRef = useRef(0);
  const pendingLoadingEpochRef = useRef(0);

  const applyPending = useCallback((data, { append = false } = {}) => {
    setQueue((current) => (append ? mergeById(current, data.queue) : data.queue));
    setPendingHasNext(Boolean(data.hasNext));
    setPendingPage(data.page ?? 1);
  }, []);

  useEffect(() => {
    const generation = ++pendingGenerationRef.current;
    const loadingEpoch = ++pendingLoadingEpochRef.current;
    let cancelled = false;
    const hadCache = Boolean(peekCurationQueueCache({ scope: "pending", page: 1 }));
    if (!hadCache) setLoading(true);
    setPendingLoadingMore(false);

    loadCurationQueue({
      scope: "pending",
      page: 1,
      forceRefresh: hadCache || reloadToken > 0,
    })
      .then((data) => {
        if (cancelled || generation !== pendingGenerationRef.current) return;
        setError("");
        applyPending(data);
      })
      .catch((err) => {
        if (cancelled || generation !== pendingGenerationRef.current) return;
        setError(err.message);
      })
      .finally(() => {
        if (!cancelled && loadingEpoch === pendingLoadingEpochRef.current) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [applyPending, reloadToken]);

  useEffect(() => {
    return subscribeCurationJobs(() => {
      setReloadToken((value) => value + 1);
      setDetailEpoch((value) => value + 1);
    });
  }, []);

  useEffect(() => {
    if (view !== "rejected" || !includeRejected) return undefined;
    let cancelled = false;
    const generation = ++rejectedGenerationRef.current;
    setRejectedStatus("loading");
    setRejectedLoadingMore(false);
    loadCurationQueue({
      scope: "rejected",
      page: 1,
      forceRefresh: reloadToken > 0,
    })
      .then((data) => {
        if (cancelled || generation !== rejectedGenerationRef.current) return;
        setError("");
        setRejected(data.rejected);
        setRejectedHasNext(Boolean(data.hasNext));
        setRejectedPage(data.page ?? 1);
        setRejectedStatus("ready");
      })
      .catch((err) => {
        if (cancelled || generation !== rejectedGenerationRef.current) return;
        setRejectedStatus("error");
        setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [view, includeRejected, reloadToken]);

  const visibleJobs = view === "rejected" ? rejected : queue;
  const selected = resolveCurationSelection(visibleJobs, selectedId);
  const detailForSelection = Boolean(selected) && detailJobId === selected.id;
  const detailReady = detailForSelection && detailStatus === "ready";
  const detailFailed = detailForSelection && detailStatus === "error";
  const detailLoading = Boolean(selected) && !detailReady && !detailFailed;

  useEffect(() => {
    if (!selectedId || selected) return;
    setSelectedId("");
    setDetailOpen(false);
    setShowReview(false);
  }, [selected, selectedId]);

  useEffect(() => {
    const jobId = selected?.id;
    if (!jobId) return undefined;
    let cancelled = false;
    setDetailJobId(jobId);
    setDetailStatus("loading");
    setDetailError("");
    loadCurationJobDetail(jobId, { forceRefresh: detailEpoch > 0 })
      .then((detail) => {
        if (cancelled) return;
        setDetailDescription(detail.description ?? "");
        setDetailStack(detail.stack ?? []);
        setDetailReviews(detail.reviews ?? []);
        setDetailStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setDetailStatus("error");
        setDetailError(err.message || "Não foi possível carregar o detalhe da vaga.");
      });
    return () => {
      cancelled = true;
    };
  }, [selected?.id, detailEpoch]);

  const loadingMore = view === "rejected" ? rejectedLoadingMore : pendingLoadingMore;

  const loadMore = async () => {
    const scope = view === "rejected" ? "rejected" : "pending";
    const isRejected = scope === "rejected";
    if (isRejected ? rejectedLoadingMore : pendingLoadingMore) return;
    if (!isRejected && loading) return;
    const hasNext = isRejected ? rejectedHasNext : pendingHasNext;
    const page = isRejected ? rejectedPage : pendingPage;
    if (!hasNext) return;
    const setScopeLoadingMore = isRejected ? setRejectedLoadingMore : setPendingLoadingMore;
    const generationRef = isRejected ? rejectedGenerationRef : pendingGenerationRef;
    const generation = ++generationRef.current;
    setScopeLoadingMore(true);
    setError("");
    try {
      const data = await loadCurationQueue({ scope, page: page + 1, forceRefresh: true });
      if (generation !== generationRef.current) return;
      setError("");
      if (isRejected) {
        setRejected((current) => mergeById(current, data.rejected));
        setRejectedHasNext(Boolean(data.hasNext));
        setRejectedPage(data.page ?? page + 1);
      } else {
        applyPending(data, { append: true });
      }
    } catch (err) {
      if (generation !== generationRef.current) return;
      setError(err.message);
    } finally {
      if (generation === generationRef.current) setScopeLoadingMore(false);
    }
  };

  const run = async (action, successMessage, afterSuccess) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      setMessage(successMessage);
      const generation = pendingGenerationRef.current;
      const data = await loadCurationQueue({ scope: "pending", page: 1, forceRefresh: true });
      if (generation !== pendingGenerationRef.current) return;
      setError("");
      applyPending(data);
      afterSuccess?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const onReview = (event) => {
    event.preventDefault();
    if (!selected) return;
    run(
      () =>
        submitCurationReview({
          jobId: selected.id,
          decision,
          rubricCode,
          internalComment: comment,
        }),
      decision === "approve" ? "Parecer de aprovação enviado." : "Parecer de rejeição enviado.",
      () => { setShowReview(false); setDetailOpen(false); setRubricCode(""); setComment(""); },
    );
  };

  return (
    <>
      <div className="admin-title">
        <div>
          <span className="eyebrow">Área administrativa</span>
          <h1>Fila de revisão</h1>
          <p>Selecione uma vaga, confira o contexto e registre seu parecer.</p>
        </div>
      </div>
      {loading && <p role="status">Carregando fila de curadoria…</p>}
      {message && (
        <div className="success">
          <Check size={18} /> {message}
        </div>
      )}
      {error && (
        <div className="form-alert" role="alert">
          {error}
        </div>
      )}
      <div className="curation-workspace__filters" role="group" aria-label="Visão da curadoria">
        <button type="button" className="ghost small" aria-pressed={view === "pending"} onClick={() => { setView("pending"); setSelectedId(""); setDetailOpen(false); setShowReview(false); }}>
          Pendentes <span>{queue.length}</span>
        </button>
        {isAdmin ? <button type="button" className="ghost small" aria-pressed={view === "rejected"} onClick={() => { setView("rejected"); setSelectedId(""); setDetailOpen(false); setShowReview(false); }}>
          Rejeitadas{rejectedStatus === "ready" ? <> <span>{rejected.length}</span></> : null}
        </button> : null}
      </div>
      <div className={`curation-workspace${detailOpen ? " curation-workspace--detail-open" : ""}`}>
      <section className="curation-workspace__queue" aria-label={view === "pending" ? "Vagas pendentes" : "Vagas rejeitadas"}>
        <h2>{view === "pending" ? "Pendentes" : "Rejeitadas"}</h2>
        {visibleJobs.length === 0 && !loading && <p role="status">{view === "pending" ? "Nenhuma vaga pendente nesta fila." : "Nenhuma vaga rejeitada para reenvio."}</p>}
        {visibleJobs.map((job) => (
          <div key={job.id} className="curation-workspace__queue-item">
            <button
              type="button"
              className="curation-workspace__select"
              aria-pressed={selected?.id === job.id}
              onClick={() => {
                setSelectedId(job.id);
                setDetailOpen(true);
                setShowReview(false);
                setMessage("");
                setError("");
                setPriorityReason("");
              }}
            >
              <span className="curation-workspace__badges">
                {job.priority === "urgent" ? <span className="featured">Urgente</span> : null}
                {job.needsModeration ? <span className="featured">Moderação</span> : null}
              </span>
              <strong>{job.title}</strong>
              <span>{job.companies?.name ?? "Empresa"} · rodada {job.curation_round}</span>
            </button>
          </div>
        ))}
        {(view === "pending" ? pendingHasNext : rejectedHasNext) ? (
          <div className="admin-jobs-more">
            <button type="button" className="outline" onClick={loadMore} disabled={loadingMore || (view === "pending" && loading)}>
              {loadingMore ? "Carregando…" : "Carregar mais"}
            </button>
          </div>
        ) : null}
      </section>
      {selected && (
        <div className="curation-workspace__detail">
          <button type="button" className="ghost curation-workspace__back" onClick={() => { setDetailOpen(false); setShowReview(false); }}>← Voltar à fila</button>
        <form className="job-form" onSubmit={onReview}>
          <div className="form-section">
            <h2>{selected.title}</h2>
            <p className="company-name">{selected.companies?.name}</p>
            {detailLoading ? <p role="status">Carregando detalhes da vaga…</p> : null}
            {detailFailed ? <p role="alert">{detailError}</p> : null}
            {detailReady ? <p>{detailDescription}</p> : null}
            <p>
              {LEVEL_LABEL[selected.level] ?? selected.level} ·{" "}
              {MODEL_LABEL[selected.work_model] ?? selected.work_model}
              {selected.location ? ` · ${selected.location}` : ""}
            </p>
            {detailReady ? (
              <div className="tags">
                {detailStack.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            ) : null}
            <details className="curation-workspace__history">
              <summary>Histórico de pareceres{detailReady ? ` (${detailReviews.length})` : ""}</summary>
              {detailLoading ? <p role="status">Carregando pareceres…</p> : null}
              {detailReady ? <CurationTimeline reviews={detailReviews} /> : null}
            </details>
          </div>
          {view === "pending" && !showReview ? <div className="curation-workspace__review-entry">
            <button type="button" className="primary" onClick={() => setShowReview(true)}>Iniciar parecer</button>
            <p>Confira a vaga antes de decidir. O parecer é enviado à curadoria, não publicado diretamente.</p>
          </div> : null}
          {view === "pending" && showReview ? <>
          <div className="form-section">
            <h2>Registrar parecer</h2>
            <fieldset className="form-grid">
              <legend>Código obrigatório</legend>
              {RUBRIC_OPTIONS.map((option) => (
                <label key={option.code} className="wide">
                  <input
                    id={`curation-rubric-${option.code}`}
                    type="radio"
                    name="rubric"
                    value={option.code}
                    checked={rubricCode === option.code}
                    onChange={() => setRubricCode(option.code)}
                    required
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>
            <fieldset className="form-grid">
              <legend>Decisão</legend>
              <label>
                <input
                  id="curation-decision-approve"
                  type="radio"
                  name="decision"
                  value="approve"
                  checked={decision === "approve"}
                  onChange={() => setDecision("approve")}
                />{" "}
                Aprovar
              </label>
              <label>
                <input
                  id="curation-decision-reject"
                  type="radio"
                  name="decision"
                  value="reject"
                  checked={decision === "reject"}
                  onChange={() => setDecision("reject")}
                />{" "}
                Rejeitar
              </label>
            </fieldset>
            <div className="wide field-with-counter">
              <label htmlFor="curation-comment">Comentário interno (opcional)</label>
              <AutoResizeTextarea
                id="curation-comment"
                name="comment"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={3}
                maxLength={TEXTAREA_LIMITS.curationComment}
                maxHeightPx={200}
                placeholder="Observação só para a equipe de curadoria"
              />
            </div>
          </div>
          </> : null}
          {isAdmin && view === "pending" && (
            <CurationPriorityControls
              jobId={selected.id}
              priority={selected.priority}
              reason={priorityReason}
              onReasonChange={setPriorityReason}
              disabled={busy}
              onPriorityChange={async (jobId, nextPriority, reason) => {
                await setJobCurationPriority(jobId, nextPriority, reason);
                setQueue((current) => {
                  const moderationIds = current.filter((job) => job.needsModeration).map((job) => job.id);
                  const updated = current.map((job) =>
                    job.id === jobId ? { ...job, priority: nextPriority } : job,
                  );
                  return mergeCurationQueue(updated, moderationIds);
                });
              }}
            />
          )}
          {view === "pending" && showReview ? <div className="form-actions">
            <button className="primary" type="submit" disabled={busy}>
              <ListChecks size={17} /> Enviar parecer
            </button>
            <button className="ghost" type="button" onClick={() => setShowReview(false)} disabled={busy}>Cancelar</button>
          </div> : null}
          {view === "rejected" && isAdmin ? <div className="form-actions">
            <button type="button" className="outline" disabled={busy} onClick={() => run(() => resubmitJobForCuration(selected.id), "Vaga reenviada em nova rodada.", () => { setView("pending"); setSelectedId(""); setDetailOpen(false); })}>
              {busy ? "Reenviando…" : "Reenviar para curadoria"}
            </button>
          </div> : null}
        </form>
        </div>
      )}
      </div>
    </>
  );
}
