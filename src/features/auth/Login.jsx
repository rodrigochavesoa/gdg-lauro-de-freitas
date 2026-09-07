import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { startGoogleOAuth } from "./auth-api.js";
import { LoginDynamicBrand } from "../../shared/ui/LoginDynamicBrand.jsx";

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

  return (
    <main className="login-page">
      <section className="login-panel">
        <button className="login-dynamic-brand" onClick={() => location.reload()} aria-label="GDGJobs — vagas em tempo real. Atualizar página de login">
          <LoginDynamicBrand />
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
        <svg className="login-panel__curve login-panel__curve--right" viewBox="0 0 80 800" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <path fill="var(--color-surface)" stroke="none" d="M 30 0 C 72 140 6 260 44 400 C 78 540 10 660 36 800 L 80 800 L 80 0 Z" />
        </svg>
        <svg className="login-panel__curve login-panel__curve--bottom" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <path fill="var(--color-surface)" stroke="none" d="M-8 52 C 180 118 380 14 560 64 C 740 112 920 8 1100 58 C 1240 96 1360 22 1448 48 L 1448 128 L -8 128 Z" />
        </svg>
      </section>
      <section className="login-form">
        <div>
          <h2>Entre na sua conta</h2>
          <p>Candidatos entram com Google. Empresas usam a área administrativa.</p>
        </div>
        {error ? (
          <p className="login-alert" role="alert">
            {error}
          </p>
        ) : null}
        <div className="login-paths">
          <h3>Você é novo no GDG Jobs?</h3>
          <div className="login-path">
            <p className="login-path__label">Candidato</p>
            <button className="google full" type="button" onClick={onGoogle} disabled={busy}>
              <img className="google-icon" src="/google-icon.svg" alt="" />
              {busy ? "Redirecionando…" : "Entrar ou criar conta com Google"}
            </button>
          </div>
          <div className="login-path">
            <p className="login-path__label">Empresa</p>
            <Link className="outline full" to="/admin">
              Publicar vagas — área administrativa
            </Link>
          </div>
        </div>
        <p className="terms">
          Ao continuar, você concorda com nossos Termos de uso e Política de privacidade. O cadastro
          do perfil não é consentimento LGPD — a base legal é definida pelo DPO.
        </p>
      </section>
    </main>
  );
}
