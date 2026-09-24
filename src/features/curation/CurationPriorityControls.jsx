import React, { useEffect, useId, useRef, useState } from "react";
import { Check } from "lucide-react";
import { validateUrgentPriority } from "./rubric.js";

const URGENT_STATUS = "Prioridade urgente registrada.";
const NORMAL_STATUS = "Prioridade definida como normal.";
const SAVING_STATUS = "Salvando prioridade…";

export function CurationPriorityControls({
  jobId,
  priority,
  reason,
  onReasonChange,
  disabled = false,
  onPriorityChange,
}) {
  const headingId = useId();
  const reasonErrorId = "curation-priority-reason-error";
  const jobIdRef = useRef(jobId);
  const [savingTarget, setSavingTarget] = useState(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  jobIdRef.current = jobId;

  useEffect(() => {
    setSavingTarget(null);
    setStatus("");
    setError("");
  }, [jobId]);

  const isUrgent = priority === "urgent";
  const saving = Boolean(savingTarget);
  const busy = disabled || saving;
  const reasonInvalid = Boolean(error) && error === validateUrgentPriority(reason);

  const save = async (nextPriority) => {
    const requestedJobId = jobId;
    setSavingTarget(nextPriority);
    setStatus("");
    setError("");

    if (nextPriority === "urgent") {
      const reasonError = validateUrgentPriority(reason);
      if (reasonError) {
        setError(reasonError);
        setSavingTarget(null);
        return;
      }
    }

    try {
      await onPriorityChange(requestedJobId, nextPriority, nextPriority === "urgent" ? reason : "");
      if (jobIdRef.current !== requestedJobId) return;
      setStatus(nextPriority === "urgent" ? URGENT_STATUS : NORMAL_STATUS);
    } catch (err) {
      if (jobIdRef.current !== requestedJobId) return;
      setError(err.message || "Não foi possível salvar a prioridade.");
    } finally {
      if (jobIdRef.current === requestedJobId) setSavingTarget(null);
    }
  };

  return (
    <section
      className="form-section curation-priority-control"
      aria-labelledby={headingId}
      aria-busy={saving ? "true" : undefined}
    >
      <h2 id={headingId}>Prioridade (admin)</h2>
      <label className="wide" htmlFor="curation-priority-reason">
        Motivo interno para urgente
        <input
          id="curation-priority-reason"
          name="priorityReason"
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          placeholder="Obrigatório ao marcar urgente"
          disabled={busy}
          aria-invalid={reasonInvalid || undefined}
          aria-describedby={reasonInvalid ? reasonErrorId : undefined}
        />
      </label>
      <div className="curation-priority-actions">
        <button
          type="button"
          className="ghost curation-priority-option curation-priority-option--normal"
          disabled={busy}
          aria-pressed={!isUrgent}
          onClick={() => save("normal")}
        >
          {savingTarget === "normal" ? "Salvando…" : "Normal"}
        </button>
        <button
          type="button"
          className="ghost curation-priority-option curation-priority-option--urgent"
          disabled={busy}
          aria-pressed={isUrgent}
          onClick={() => save("urgent")}
        >
          {savingTarget === "urgent" ? "Salvando…" : "Urgente"}
        </button>
      </div>
      <div className="curation-priority-feedback" aria-live="polite">
        <div className="curation-priority-feedback__slot">
          {saving ? (
            <p className="tiny" role="status">
              {SAVING_STATUS}
            </p>
          ) : status ? (
            <div className="success" role="status">
              <Check size={18} aria-hidden="true" /> {status}
            </div>
          ) : error ? (
            <div
              id={reasonInvalid ? reasonErrorId : undefined}
              className="form-alert"
              role="alert"
            >
              {error}
            </div>
          ) : (
            <span className="sr-only" role="status">
              {"\u00a0"}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
