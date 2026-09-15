import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, History, LockKeyhole, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import {
  groupCurrentPrivacyEvents,
  loadPrivacyPreferences,
  recordPrivacyNotice,
  revokePurpose,
  saveOptionalChoice,
} from "./privacy-api.js";
import { NECESSARY_NOTICE, OPTIONAL_PURPOSE, currentPurposeState } from "./privacy-catalog.js";

const statusLabels = {
  notice: "Aviso registrado",
  accepted: "Ativada por você",
  refused: "Recusada",
  revoked: "Revogada",
  not_recorded: "Ainda não escolhida",
};

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function PurposeCard({ purpose, event, history, busy, onNotice, onChoice, onRevoke }) {
  const state = currentPurposeState(purpose, event);
  const necessary = purpose.classification === NECESSARY_NOTICE;
  const optional = purpose.classification === OPTIONAL_PURPOSE;
  const inactive = purpose.status !== "active";
  const checked = state.currentEvent?.event_type === "accepted";

  return (
    <article className={["privacy-card", inactive ? "privacy-card--inactive" : ""].filter(Boolean).join(" ")}>
      <div className="privacy-card__topline">
        <span className="privacy-card__code">{purpose.purpose_code} · v{purpose.version}</span>
        <span className={["privacy-badge", necessary ? "privacy-badge--required" : ""].join(" ")}>
          {necessary ? "Necessário" : "Opcional"}
        </span>
      </div>
      <h2>{purpose.title}</h2>
      <p>{purpose.specific_description}</p>
      <div className="privacy-card__metadata">
        <span><b>Base legal:</b> {purpose.legal_basis_status}</span>
        <span><b>Retenção:</b> {purpose.retention_status}</span>
      </div>
      <p className="privacy-card__effect"><b>Se você desligar:</b> {purpose.revocation_effect}</p>

      {inactive ? (
        <div className="privacy-card__notice" role="status">
          <CircleAlert size={17} aria-hidden="true" />
          <span>Em preparação. Esta finalidade não está disponível para escolha.</span>
        </div>
      ) : necessary ? (
        <div className="privacy-card__actions">
          <div className="privacy-card__state"><LockKeyhole size={17} aria-hidden="true" />{statusLabels[state.choice]}</div>
          {!state.currentEvent || state.currentEvent.event_type !== "notice" ? (
            <button className="outline" type="button" disabled={busy} onClick={() => onNotice(purpose.purpose_code)}>
              {busy ? "Registrando…" : "Registrar que li"}
            </button>
          ) : null}
        </div>
      ) : optional ? (
        <div className="privacy-card__actions">
          <label className="privacy-toggle">
            <input
              type="checkbox"
              checked={checked}
              disabled={busy}
              onChange={(inputEvent) => onChoice(purpose.purpose_code, inputEvent.target.checked)}
            />
            <span className="privacy-toggle__box" aria-hidden="true" />
            <span>{checked ? "Ativada" : "Desativada"}</span>
          </label>
          <span className="privacy-card__state">{statusLabels[state.choice]}</span>
          {checked ? (
            <button className="ghost" type="button" disabled={busy} onClick={() => onRevoke(purpose.purpose_code)}>
              {busy ? "Revogando…" : "Revogar"}
            </button>
          ) : null}
        </div>
      ) : null}

      {history.length > 0 ? (
        <details className="privacy-history">
          <summary><History size={16} aria-hidden="true" /> Histórico desta finalidade ({history.length})</summary>
          <ul>
            {history.map((item) => (
              <li key={item.id}>
                <span>{statusLabels[item.event_type] ?? item.event_type}</span>
                <time dateTime={item.created_at}>{formatDate(item.created_at)}</time>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </article>
  );
}

export function PrivacyPreferences() {
  const [data, setData] = useState({ purposes: [], events: [], source: "supabase" });
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [busyCode, setBusyCode] = useState(null);

  const load = async () => {
    setError("");
    try {
      setData(await loadPrivacyPreferences());
      setStatus("ready");
    } catch (loadError) {
      setError(loadError.message || "Não foi possível carregar suas preferências.");
      setStatus("error");
    }
  };

  useEffect(() => { load(); }, []);

  const currentEvents = useMemo(() => groupCurrentPrivacyEvents(data.events), [data.events]);
  const historyByPurpose = useMemo(() => data.events.reduce((result, event) => {
    result[event.purpose_code] ??= [];
    result[event.purpose_code].push(event);
    return result;
  }, {}), [data.events]);

  const run = async (purposeCode, action) => {
    setBusyCode(purposeCode);
    setError("");
    try {
      await action();
      await load();
    } catch (actionError) {
      setError(actionError.message || "Não foi possível atualizar essa finalidade.");
    } finally {
      setBusyCode(null);
    }
  };

  return (
    <main id="conteudo" tabIndex={-1} className="privacy-page">
      <div className="shell privacy-shell">
        <div className="privacy-header">
          <div>
            <span className="eyebrow"><ShieldCheck size={15} aria-hidden="true" /> Privacidade</span>
            <h1>Suas preferências de privacidade</h1>
            <p>Veja como o GDG Jobs usa seus dados e escolha, separadamente, o que é opcional. Sua conta, perfil e candidaturas continuam disponíveis quando uma finalidade opcional está desligada.</p>
          </div>
          <Link className="outline" to="/">Voltar ao início</Link>
        </div>
        {data.source === "fallback" ? <p className="privacy-page__note" role="status">As preferências serão salvas quando o ambiente Supabase estiver configurado.</p> : null}
        {error ? <p className="privacy-alert" role="alert">{error}</p> : null}
        {status === "loading" ? <div className="privacy-loading" aria-busy="true">Carregando suas preferências…</div> : null}
        {status === "ready" ? (
          <div className="privacy-list">
            {data.purposes.map((purpose) => (
              <PurposeCard
                key={`${purpose.purpose_code}-${purpose.version}`}
                purpose={purpose}
                event={currentEvents[purpose.purpose_code]}
                history={historyByPurpose[purpose.purpose_code] ?? []}
                busy={busyCode === purpose.purpose_code}
                onNotice={(code) => run(code, () => recordPrivacyNotice(code))}
                onChoice={(code, accepted) => run(code, () => saveOptionalChoice(code, accepted))}
                onRevoke={(code) => run(code, () => revokePurpose(code))}
              />
            ))}
          </div>
        ) : null}
        <div className="privacy-footer-note">
          <CheckCircle2 size={18} aria-hidden="true" />
          <p>As escolhas opcionais começam desativadas. Bases legais, textos e prazos marcados como <code>pending_dpo</code> ainda aguardam revisão e não liberam novos tratamentos.</p>
        </div>
      </div>
    </main>
  );
}
