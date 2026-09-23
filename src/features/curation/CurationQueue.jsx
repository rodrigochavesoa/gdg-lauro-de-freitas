import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ListChecks } from "lucide-react";
import {
  loadCurationQueue,
  peekCurationQueueCache,
  resubmitJobForCuration,
  setJobCurationPriority,
  submitCurationReview,
  subscribeCurationJobs,
} from "./curation-api.js";
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

export function CurationQueue({ profile, includeRejected = false }) {
  const isAdmin = profile.role === "admin";
  const cached = peekCurationQueueCache({ includeRejected });
  const [queue, setQueue] = useState(() => cached?.queue ?? []);
  const [rejected, setRejected] = useState(() => (includeRejected ? cached?.rejected ?? [] : []));
  const [reviews, setReviews] = useState(() => cached?.reviews ?? []);
  const [selectedId, setSelectedId] = useState("");
  const [decision, setDecision] = useState("approve");
  const [rubricCode, setRubricCode] = useState("");
  const [comment, setComment] = useState("");
  const [priorityReason, setPriorityReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(() => !cached);
  const [view, setView] = useState("pending");
  const [detailOpen, setDetailOpen] = useState(false);
  const [showReview, setShowReview] = useState(false);

  const applyPayload = useCallback((data) => {
    setQueue(data.queue);
    setRejected(includeRejected ? data.rejected : []);
    setReviews(data.reviews);
  }, [includeRejected]);

  useEffect(() => {
    let cancelled = false;
    const hadCache = Boolean(peekCurationQueueCache({ includeRejected }));
    if (!hadCache) setLoading(true);

    const refresh = async ({ background = false } = {}) => {
      const data = await loadCurationQueue({
        includeRejected,
        forceRefresh: background,
      });
      if (cancelled) return;
      applyPayload(data);
    };

    refresh({ background: hadCache })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    const unsubscribe = subscribeCurationJobs(() => {
      if (!cancelled) {
        refresh({ background: true }).catch((err) => setError(err.message));
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [includeRejected, applyPayload]);

  const visibleJobs = view === "rejected" ? rejected : queue;
  const selected = visibleJobs.find((job) => job.id === selectedId) ?? visibleJobs[0] ?? null;
  const selectedReviews = useMemo(() => {
    if (!selected) return [];
    return reviews.filter((row) => row.job_id === selected.id);
  }, [reviews, selected]);

  const run = async (action, successMessage, afterSuccess) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      setMessage(successMessage);
      const data = await loadCurationQueue({ includeRejected, forceRefresh: true });
      applyPayload(data);
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
          Rejeitadas <span>{rejected.length}</span>
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
              {job.priority === "urgent" && <span className="featured">Urgente</span>}
              {job.needsModeration && <span className="featured">Moderação</span>}
              <strong>{job.title}</strong>
              <span>{job.companies?.name ?? "Empresa"} · rodada {job.curation_round}</span>
            </button>
          </div>
        ))}
      </section>
      {selected && (
        <div className="curation-workspace__detail">
          <button type="button" className="ghost curation-workspace__back" onClick={() => { setDetailOpen(false); setShowReview(false); }}>← Voltar à fila</button>
        <form className="job-form" onSubmit={onReview}>
          <div className="form-section">
            <h2>{selected.title}</h2>
            <p className="company-name">{selected.companies?.name}</p>
            <p>{selected.description}</p>
            <p>
              {LEVEL_LABEL[selected.level] ?? selected.level} ·{" "}
              {MODEL_LABEL[selected.work_model] ?? selected.work_model}
              {selected.location ? ` · ${selected.location}` : ""}
            </p>
            <div className="tags">
              {(selected.stack ?? []).map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <details className="curation-workspace__history">
              <summary>Histórico de pareceres ({selectedReviews.length})</summary>
              <CurationTimeline reviews={selectedReviews} />
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
                setQueue((current) =>
                  current.map((job) => (job.id === jobId ? { ...job, priority: nextPriority } : job)),
                );
                try {
                  const data = await loadCurationQueue({ includeRejected, forceRefresh: true });
                  applyPayload(data);
                } catch (refreshErr) {
                  setError(refreshErr.message || "Prioridade salva, mas a fila não atualizou.");
                }
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
