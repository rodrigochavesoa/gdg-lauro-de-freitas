import React, { useEffect, useId, useRef, useState } from "react";
import { COMPANY_SEARCH_MAX_LENGTH, loadCompanies } from "../../lib/admin-api.js";

const SEARCH_DELAY_MS = 250;
const SEARCH_ERROR = "Não foi possível buscar empresas agora. Tente novamente.";

export function AdminCompanyPicker({ selectedCompany, onSelect, disabled = false }) {
  const id = useId();
  const inputId = `admin-company-search-${id}`;
  const listboxId = `admin-company-options-${id}`;
  const statusId = `admin-company-status-${id}`;
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const requestIdRef = useRef(0);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [truncated, setTruncated] = useState(false);
  const [status, setStatus] = useState("idle");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [retry, setRetry] = useState(0);
  const term = query.trim();

  useEffect(() => {
    if (!open || term.length < 2) {
      requestIdRef.current += 1;
      setCompanies([]);
      setTruncated(false);
      setStatus("idle");
      setActiveIndex(-1);
      return undefined;
    }

    let cancelled = false;
    const requestId = ++requestIdRef.current;
    setStatus("loading");
    const timer = window.setTimeout(() => {
      loadCompanies({ query: term })
        .then((result) => {
          if (cancelled || requestId !== requestIdRef.current) return;
          setCompanies(result.companies);
          setTruncated(result.truncated);
          setActiveIndex(-1);
          setStatus("ready");
        })
        .catch(() => {
          if (cancelled || requestId !== requestIdRef.current) return;
          setCompanies([]);
          setTruncated(false);
          setStatus("error");
        });
    }, SEARCH_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (requestIdRef.current === requestId) requestIdRef.current += 1;
    };
  }, [open, retry, term]);

  const choose = (company) => {
    requestIdRef.current += 1;
    onSelect(company);
    setQuery("");
    setCompanies([]);
    setTruncated(false);
    setOpen(false);
    setStatus("idle");
    setActiveIndex(-1);
  };

  const clearSelection = () => {
    onSelect(null);
    inputRef.current?.focus();
    setOpen(true);
  };

  const onKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      if (status === "ready" && companies.length) {
        setActiveIndex((index) => Math.min(index + 1, companies.length - 1));
      }
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (status === "ready" && companies.length) {
        setActiveIndex((index) => (index < 0 ? companies.length - 1 : Math.max(index - 1, 0)));
      }
    } else if (event.key === "Enter" && open && term.length >= 2) {
      event.preventDefault();
      if (status === "ready" && activeIndex >= 0 && companies[activeIndex]) choose(companies[activeIndex]);
    } else if (event.key === "Escape") {
      requestIdRef.current += 1;
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  const onBlur = (event) => {
    if (!rootRef.current?.contains(event.relatedTarget)) {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  let statusText = "";
  if (term.length < 2) statusText = "Digite ao menos 2 caracteres para buscar.";
  else if (status === "loading") statusText = "Buscando empresas…";
  else if (status === "error") statusText = SEARCH_ERROR;
  else if (status === "ready" && companies.length === 0) statusText = "Nenhuma empresa encontrada para esta busca.";
  else if (status === "ready" && truncated) statusText = "Exibindo até 20 resultados. Refine a busca para localizar outras empresas.";
  else if (status === "ready") statusText = `${companies.length} ${companies.length === 1 ? "empresa encontrada" : "empresas encontradas"}.`;

  return (
    <div className="admin-company-picker" ref={rootRef} onBlur={onBlur}>
      <label htmlFor={inputId}>Buscar empresa cadastrada</label>
      <input
        ref={inputRef}
        id={inputId}
        name="companySearch"
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && term.length >= 2}
        aria-controls={open && term.length >= 2 ? listboxId : undefined}
        aria-activedescendant={status === "ready" && activeIndex >= 0 && companies[activeIndex] ? `${listboxId}-option-${activeIndex}` : undefined}
        aria-describedby={statusText ? statusId : undefined}
        autoComplete="off"
        maxLength={COMPANY_SEARCH_MAX_LENGTH}
        readOnly={Boolean(selectedCompany)}
        value={selectedCompany?.name ?? query}
        disabled={disabled}
        placeholder="Digite o nome da empresa"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          requestIdRef.current += 1;
          if (selectedCompany) onSelect(null);
          setQuery(event.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onKeyDown={onKeyDown}
      />
      {selectedCompany ? (
        <div className="admin-company-picker__selected" aria-live="polite">
          <span><strong>Empresa selecionada para esta vaga</strong></span>
          <button type="button" className="ghost small" disabled={disabled} onClick={clearSelection}>
            Alterar empresa
          </button>
        </div>
      ) : null}
      {open && term.length >= 2 ? (
        <div className="admin-company-picker__popup">
          <p className="admin-company-picker__status" aria-hidden="true">
            {statusText}
          </p>
          {status === "error" ? (
            <button type="button" className="outline small" onClick={() => setRetry((count) => count + 1)}>
              Tentar novamente
            </button>
          ) : null}
          <ul className="admin-company-picker__options" id={listboxId} role="listbox" aria-label="Empresas encontradas">
            {status === "ready" ? companies.map((company, index) => (
              <li
                id={`${listboxId}-option-${index}`}
                key={company.id}
                role="option"
                tabIndex={-1}
                aria-selected={index === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    choose(company);
                  }
                }}
                onClick={() => choose(company)}
              >
                {company.name}
              </li>
            )) : null}
          </ul>
        </div>
      ) : null}
      <span className="sr-only" id={statusId} role={status === "error" ? "alert" : "status"} aria-live="polite">{statusText}</span>
    </div>
  );
}
