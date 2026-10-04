import React from "react";
import { Search, X } from "lucide-react";

export function AdminListSearch({ value, onChange, onSubmit, onClear, label, placeholder, className = "", id = "admin-list-search-query" }) {
  const clear = () => {
    onChange("");
    onClear?.();
  };

  return (
    <form className={`searchbox admin-jobs-searchbox admin-list-search ${className}`.trim()} role="search" aria-label={label} onSubmit={onSubmit}>
      <Search size={21} aria-hidden="true" />
      <input
        id={id}
        name="q"
        type="text"
        role="searchbox"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {value ? (
        <button type="button" className="ghost small admin-list-search__clear" onClick={clear}>
          <X size={16} aria-hidden="true" /> Limpar busca
        </button>
      ) : null}
      <button className="primary" type="submit">Buscar</button>
    </form>
  );
}
