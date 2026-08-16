import React, { useEffect, useMemo, useState } from "react";
import { Check, ListChecks } from "lucide-react";
import {
  loadCurationQueue,
  resubmitJobForCuration,
  setJobCurationPriority,
  submitCurationReview,
  subscribeCurationJobs,
} from "./curation-api.js";
import { RUBRIC_OPTIONS } from "./rubric.js";

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

function roleLabel(role) {
  if (role === "admin") return "administração";
  if (role === "moderator") return "moderação";
  return "curadoria";
}

export function CurationQueue({ profile, onLogout }) {
  const isAdmin = profile.role === "admin";
  const [queue, setQueue] = useState([]);
  const [rejected, setRejected] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [decision, setDecision] = useState("approve");
  const [rubricCode, setRubricCode] = useState("");
  const [comment, setComment] = useState("");
  const [priorityReason, setPriorityReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const data = await loadCurationQueue();
      if (cancelled) return;
      setQueue(data.queue);
      setRejected(isAdmin ? data.rejected : []);
      setReviews(data.reviews);
    };
    refresh()
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    const unsubscribe = subscribeCurationJobs(() => {
      if (!cancelled) {
        refresh().catch((err) => setError(err.message));
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [isAdmin]);

  const selected = queue.find((job) => job.id === selectedId) ?? queue[0] ?? null;
  const selectedReviews = useMemo(() => {
    if (!selected) return [];
    return reviews.filter(
      (row) => row.job_id === selected.id && row.curation_round === selected.curation_round,
    );
  }, [reviews, selected]);

  const run = async (action, successMessage) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      setMessage(successMessage);
      const data = await loadCurationQueue();
      setQueue(data.queue);
      setRejected(isAdmin ? data.rejected : []);
      setReviews(data.reviews);
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
    );
  };

  return (
    <>
      <div className="admin-title">
        <div>
          <span className="eyebrow">Curadoria V1</span>
          <h1>Fila de revisão</h1>
          <p>
            Pendentes com urgente primeiro. Empate aparece como needs_moderation. Decisão só via RPC.
          </p>
        </div>
        <button type="button" className="outline" onClick={onLogout}>
          Sair
        </button>
      </div>
      <div className="admin-user">
        <span className="avatar">{(profile.full_name || "C").slice(0, 2).toUpperCase()}</span>
        <div>
          <strong>{profile.full_name || profile.email}</strong>
          <small>{roleLabel(profile.role)}</small>
        </div>
      </div>
      {loading && <p>Carregando fila de curadoria…</p>}
      {message && (
        <div className="success">
          <Check size={18} /> {message}
        </div>
      )}
      {error && (
        <div className="success" role="alert">
          {error}
        </div>
      )}
      <div className="form-section">
        <h2>Vagas pending</h2>
        {queue.length === 0 && !loading && <p>Nenhuma vaga pendente nesta fila.</p>}
        {queue.map((job) => (
          <p key={job.id}>
            <button
              type="button"
              className="ghost"
              aria-pressed={selected?.id === job.id}
              onClick={() => {
                setSelectedId(job.id);
                setMessage("");
                setError("");
              }}
            >
              {job.priority === "urgent" && <span className="featured">Urgente</span>}
              {job.needsModeration && <span className="featured">Moderação</span>}
              {job.title} — {job.companies?.name ?? "Empresa"} · rodada {job.curation_round}
            </button>
          </p>
        ))}
      </div>
      {selected && (
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
            <p>
              Pareceres nesta rodada:{" "}
              {selectedReviews.length === 0
                ? "nenhum ainda"
                : selectedReviews.map((row) => row.decision).join(", ")}
            </p>
          </div>
          <div className="form-section">
            <h2>Rubrica</h2>
            <fieldset className="form-grid">
              <legend>Código obrigatório</legend>
              {RUBRIC_OPTIONS.map((option) => (
                <label key={option.code} className="wide">
                  <input
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
                  type="radio"
                  name="decision"
                  value="reject"
                  checked={decision === "reject"}
                  onChange={() => setDecision("reject")}
                />{" "}
                Rejeitar
              </label>
            </fieldset>
            <label className="wide">
              Comentário interno (opcional)
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows="3"
                placeholder="Observação só para a equipe de curadoria"
              />
            </label>
          </div>
          {isAdmin && (
            <div className="form-section">
              <h2>Prioridade (admin)</h2>
              <label className="wide">
                Motivo interno para urgente
                <input
                  value={priorityReason}
                  onChange={(event) => setPriorityReason(event.target.value)}
                  placeholder="Obrigatório ao marcar urgente"
                />
              </label>
              <div className="form-actions">
                <button
                  type="button"
                  className="ghost"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => setJobCurationPriority(selected.id, "normal", ""),
                      "Prioridade definida como normal.",
                    )
                  }
                >
                  Normal
                </button>
                <button
                  type="button"
                  className="outline"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => setJobCurationPriority(selected.id, "urgent", priorityReason),
                      "Prioridade urgente registrada.",
                    )
                  }
                >
                  Marcar urgente
                </button>
              </div>
            </div>
          )}
          <div className="form-actions">
            <button className="primary" type="submit" disabled={busy}>
              <ListChecks size={17} /> Enviar parecer
            </button>
          </div>
        </form>
      )}
      {isAdmin && (
        <div className="form-section">
          <h2>Reenvio de rejeitadas</h2>
          {rejected.length === 0 && <p>Nenhuma vaga rejected para reenviar.</p>}
          {rejected.map((job) => (
            <p key={job.id}>
              {job.title} · rodada {job.curation_round}{" "}
              <button
                type="button"
                className="ghost"
                disabled={busy}
                onClick={() =>
                  run(
                    () => resubmitJobForCuration(job.id),
                    "Vaga reenviada em nova rodada.",
                  )
                }
              >
                Reenviar
              </button>
            </p>
          ))}
        </div>
      )}
    </>
  );
}
