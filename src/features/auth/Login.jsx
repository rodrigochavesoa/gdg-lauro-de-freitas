import React, { useState } from "react";
import { Sparkles } from "lucide-react";
import { startGoogleOAuth } from "./auth-api.js";

export function Login() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onGoogle = async () => {
    setBusy(true);
    setError("");
    try {
      await startGoogleOAuth();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const onEmailContinue = (event) => {
    event.preventDefault();
    setError("Nesta homologação, entre com Google. E-mail e senha ficam para admin e curadoria.");
  };

  return (
    <main className="login-page">
      <section className="login-panel">
        <button className="login-dynamic-brand" onClick={() => location.reload()} aria-label="Atualizar página de login">
          <img src="/gdg-jobs-dynamic-brand.svg" alt="GDGJobs — vagas em tempo real" />
        </button>
        <img className="login-illustration" src="/login-gdg-illustration.svg" alt="" aria-hidden="true" />
        <div className="login-copy">
          <div className="eyebrow">
            <Sparkles size={15} /> Bem-vindo de volta
          </div>
          <h1>Grandes oportunidades começam aqui.</h1>
          <p>Acesse sua conta para salvar vagas e se candidatar com um clique.</p>
        </div>
        <div className="quote">
          “Uma comunidade feita por pessoas que acreditam no poder da tecnologia.”
          <span>— GDG Lauro de Freitas</span>
        </div>
      </section>
      <section className="login-form">
        <div>
          <h2>Entre na sua conta</h2>
          <p>Use sua conta Google para continuar.</p>
        </div>
        <button className="google" type="button" onClick={onGoogle} disabled={busy}>
          <img className="google-icon" src="/google-icon.svg" alt="" />
          {busy ? "Redirecionando…" : "Continuar com Google"}
        </button>
        <div className="divider">
          <span />
          ou
          <span />
        </div>
        <form onSubmit={onEmailContinue}>
          <label>
            E-mail
            <input type="email" placeholder="voce@email.com" />
          </label>
          <button className="primary full" type="submit">
            Continuar
          </button>
        </form>
        {error && (
          <p className="terms" role="alert">
            {error}
          </p>
        )}
        <p className="terms">
          Ao continuar, você concorda com nossos Termos de uso e Política de privacidade. O cadastro
          do perfil não é consentimento LGPD — a base legal é definida pelo DPO.
        </p>
      </section>
    </main>
  );
}
