import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { formatStaffPrivilegedApiError } from "../../lib/staff-api-errors.js";
import { CurationTimeline } from "../curation/CurationTimeline.jsx";
import { loadAdminJob } from "../../lib/admin-api.js";
import { deleteAdminJob } from "./admin-jobs-api.js";
import { adminJobStatusLabel } from "./job-form-state.js";
import { AdminPanelShimmer } from "../../shared/ui/AdminPanelShimmer.jsx";
import { AdminBackLink } from "../../shared/ui/AdminBackControl.jsx";
import { useDialogFocusTrap } from "../../shared/ui/useDialogFocusTrap.js";

export function AdminJobDetailRoute() {
  const { id } = useParams();
  const { search } = useLocation();
  const { profile } = useOutletContext() ?? {};
  const navigate = useNavigate();
  const backQuery = new URLSearchParams(search).get("back");
  const backTo = `/admin/vagas${backQuery?.startsWith("?") && backQuery.length < 2048 ? backQuery : ""}`;
  const [job, setJob] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const deleteDialogRef = useRef(null);
  const deleteInputRef = useRef(null);

  useDialogFocusTrap({ active: deleteDialogOpen, containerRef: deleteDialogRef, initialFocusRef: deleteInputRef });

  useEffect(() => {
    if (!deleteDialogOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !deleteBusy) setDeleteDialogOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [deleteBusy, deleteDialogOpen]);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setError("");
    loadAdminJob(id)
      .then((row) => {
        if (cancelled) return;
        setJob(row);
        setStatus(row ? "ready" : "missing");
      })
      .catch((err) => {
        if (cancelled) return;
        setJob(null);
        setStatus("error");
        setError(formatStaffPrivilegedApiError(err.message));
      });
    return () => {
      cancelled = true;
    };
  }, [id, reloadToken]);

  if (status === "loading") {
    return (
      <>
        <p className="sr-only" role="status">Carregando vaga…</p>
        <AdminPanelShimmer variant="detail" />
      </>
    );
  }

  if (status === "missing" || status === "error") {
    return (
      <>
        <div className="admin-title admin-job-detail-title">
          <p role="status">Vaga não encontrada ou indisponível.</p>
          <AdminBackLink to={backTo}>Voltar às vagas</AdminBackLink>
        </div>
        {error ? (
          <div className="form-alert" role="alert">
            {error}
            <button type="button" className="outline small" onClick={() => setReloadToken((token) => token + 1)}>
              Tentar novamente
            </button>
          </div>
        ) : null}
      </>
    );
  }

  const pending = job.status === "pending";
  const confirmDelete = async () => {
    if (deletePhrase !== "EXCLUIR" || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await deleteAdminJob(job.id);
      navigate(backTo, { replace: true, state: { deletedJobTitle: job.title } });
    } catch (err) {
      setDeleteError(formatStaffPrivilegedApiError(err.message));
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <>
      <div className="admin-title admin-job-detail-title">
        <div>
          <span className="eyebrow">Área administrativa</span>
          <h1>{job.title}</h1>
          <p>
            {job.companies?.name ? `${job.companies.name} · ` : ""}
            {adminJobStatusLabel(job.status)}
          </p>
        </div>
        <AdminBackLink to={backTo}>Voltar às vagas</AdminBackLink>
      </div>
      <div className="form-section admin-job-detail-body">
        <h2>Sobre a vaga</h2>
        {job.description ? <p>{job.description}</p> : null}
        <CurationTimeline reviews={job.job_curation_reviews} />
      </div>
      <div className="admin-home-actions admin-job-detail-actions">
        {pending ? (
          <Link className="primary small" to={`/admin/vagas/nova?editar=${encodeURIComponent(job.id)}`}>
            Editar rascunho
          </Link>
        ) : (
          <Link className="primary small" to="/admin/curadoria">
            Abrir curadoria
          </Link>
        )}
        {profile?.role === "admin" ? (
          <button
            type="button"
            className="admin-job-delete-trigger small"
            onClick={() => {
              setDeletePhrase("");
              setDeleteError("");
              setDeleteDialogOpen(true);
            }}
          >
            Excluir vaga
          </button>
        ) : null}
      </div>
      {pending ? null : <p className="admin-dashboard-quiet">Mudanças de vagas publicadas ou rejeitadas passam por uma nova rodada de curadoria.</p>}
      {deleteDialogOpen ? (
        <div className="admin-job-delete-backdrop">
          <section
            ref={deleteDialogRef}
            className="admin-job-delete-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-job-title"
            aria-describedby="delete-job-warning"
            tabIndex={-1}
          >
            <h2 id="delete-job-title">Excluir vaga permanentemente?</h2>
            <p id="delete-job-warning">
              A vaga “{job.title}” será removida. Esta ação também exclui as candidaturas e os pareceres de curadoria vinculados; registros de ingestão permanecem sem vínculo.
            </p>
            <label htmlFor="delete-job-confirmation">Digite EXCLUIR para confirmar</label>
            <input
              id="delete-job-confirmation"
              ref={deleteInputRef}
              autoComplete="off"
              value={deletePhrase}
              onChange={(event) => setDeletePhrase(event.target.value)}
              disabled={deleteBusy}
            />
            {deleteError ? <p className="form-alert" role="alert">{deleteError}</p> : null}
            <div className="admin-job-delete-actions">
              <button
                type="button"
                className="outline small admin-job-delete-cancel"
                disabled={deleteBusy}
                onClick={() => setDeleteDialogOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="admin-job-delete-confirm small"
                disabled={deletePhrase !== "EXCLUIR" || deleteBusy}
                onClick={confirmDelete}
              >
                {deleteBusy ? "Excluindo…" : "Confirmar exclusão"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
