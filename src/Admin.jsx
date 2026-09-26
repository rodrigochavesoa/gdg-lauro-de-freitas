import React, { useEffect, useRef, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { loadCurationProfile, signInCuration } from "./features/curation/curation-api.js";
import {
  enrollStaffTotp,
  formatStaffMfaUserMessage,
  getStaffMfaAssurance,
  isStaffMfaRequired,
  needsStaffMfaStep,
  staffMfaQrSrc,
  verifyStaffTotp,
} from "./features/auth/staff-mfa.js";
import { AdminNav } from "./features/admin/AdminNav.jsx";
import { AdminSurfaceCurve } from "./features/admin/AdminSurfaceCurve.jsx";
import { toCurationProfile } from "./features/admin/staff-access.js";

function StaffMfaQr({ qrCode }) {
  const src = staffMfaQrSrc(qrCode);
  if (!src) return null;
  return <img className="admin-mfa-qr" alt="QR code do autenticador" src={src} />;
}

export function Admin({ setLogged, session, authReady = true, authProfile = null, profileHydrated = true }) {
  const snapshotStaff = toCurationProfile(authProfile, session);
  const mfaRequiredAtBoot = isStaffMfaRequired();
  const waitingForShellProfile = Boolean(session) && !profileHydrated && !snapshotStaff;
  const [ready, setReady] = useState(
    () => Boolean(authReady) && !waitingForShellProfile && !(mfaRequiredAtBoot && session),
  );
  const [profile, setProfile] = useState(() => (authReady && !mfaRequiredAtBoot ? snapshotStaff : null));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [mfaPending, setMfaPending] = useState(null);
  const [mfaEnroll, setMfaEnroll] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const staffBootId = useRef(null);

  useEffect(() => {
    if (!authReady) return undefined;
    let cancelled = false;

    const bootAdmin = (current) => {
      staffBootId.current = current.id;
      setProfile(current);
      setLogged?.(true);
      setReady(true);
    };

    const clearSensitiveAuth = () => {
      setEmail("");
      setPassword("");
      setTotpCode("");
      setMfaPending(null);
      setMfaEnroll(null);
      setError("");
    };

    if (!session) {
      staffBootId.current = null;
      setProfile(null);
      setLogged?.(false);
      clearSensitiveAuth();
      setReady(true);
      return undefined;
    }

    const admitStaff = async (current) => {
      if (!isStaffMfaRequired()) {
        bootAdmin(current);
        return;
      }
      try {
        const assurance = await getStaffMfaAssurance();
        if (cancelled) return;
        if (needsStaffMfaStep(assurance)) {
          setProfile(null);
          setMfaPending({ profile: current, assurance });
          setReady(true);
          return;
        }
        setMfaPending(null);
        setMfaEnroll(null);
        bootAdmin(current);
      } catch (err) {
        if (cancelled) return;
        setProfile(null);
        setMfaPending(null);
        setError(formatStaffMfaUserMessage(err.message));
        setReady(true);
      }
    };

    const fromSnapshot = toCurationProfile(authProfile, session);
    if (!profileHydrated && !fromSnapshot) {
      return () => {
        cancelled = true;
      };
    }
    if (fromSnapshot) {
      if (staffBootId.current !== fromSnapshot.id) void admitStaff(fromSnapshot);
      return () => {
        cancelled = true;
      };
    }

    if (authProfile) {
      staffBootId.current = null;
      setProfile(null);
      setLogged?.(false);
      setReady(true);
      return () => {
        cancelled = true;
      };
    }

    setReady(true);
    loadCurationProfile()
      .then((current) => {
        if (cancelled || !current) return;
        return admitStaff(current);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [authReady, authProfile, profileHydrated, session, setLogged]);

  const onLogin = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const current = await signInCuration(email, password);
      if (isStaffMfaRequired()) {
        const assurance = await getStaffMfaAssurance();
        if (needsStaffMfaStep(assurance)) {
          setProfile(null);
          setMfaPending({ profile: current, assurance });
          return;
        }
      }
      setMfaPending(null);
      setMfaEnroll(null);
      staffBootId.current = current.id;
      setProfile(current);
      setLogged?.(true);
    } catch (err) {
      setError(formatStaffMfaUserMessage(err.message));
    } finally {
      setEmail("");
      setPassword("");
      setBusy(false);
    }
  };

  const onEnrollMfa = async () => {
    setBusy(true);
    setError("");
    try {
      const enrolled = await enrollStaffTotp();
      setMfaEnroll(enrolled);
    } catch (err) {
      setError(formatStaffMfaUserMessage(err.message));
    } finally {
      setBusy(false);
    }
  };

  const onVerifyMfa = async (event) => {
    event.preventDefault();
    const factorId = mfaEnroll?.factorId ?? mfaPending?.assurance?.verifiedTotp?.[0]?.id;
    if (!factorId) {
      setError("Cadastre um autenticador antes de confirmar o código.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await verifyStaffTotp({ factorId, code: totpCode });
      const current = mfaPending?.profile;
      setTotpCode("");
      setMfaEnroll(null);
      setMfaPending(null);
      if (!current) return;
      staffBootId.current = current.id;
      setProfile(current);
      setLogged?.(true);
    } catch (err) {
      setError(formatStaffMfaUserMessage(err.message));
    } finally {
      setBusy(false);
    }
  };

  if (!ready) {
    return (
      <main id="conteudo" tabIndex={-1} className="admin-page">
        <div className="shell admin-auth-shell">
          <section className="admin-content">
            <p role="status">Carregando área administrativa…</p>
          </section>
        </div>
        <AdminSurfaceCurve />
      </main>
    );
  }

  if (!profile) {
    if (mfaPending) {
      const needsEnroll = !mfaEnroll && (mfaPending.assurance?.verifiedTotp?.length ?? 0) === 0;
      return (
        <main id="conteudo" tabIndex={-1} className="admin-page">
          <div className="shell admin-auth-shell">
            <section className="admin-content">
              <div className="admin-title">
                <div>
                  <span className="eyebrow">Área administrativa</span>
                  <h1>Confirmar segundo fator</h1>
                  <p role="status">
                    Você já entrou com e-mail e senha. Digite o código de 6 dígitos do autenticador para abrir curadoria, vagas e ingestão.
                  </p>
                </div>
              </div>
              <form className="admin-auth-form" onSubmit={onVerifyMfa}>
                <div className="form-section">
                  <h2>Autenticador TOTP</h2>
                  {needsEnroll ? (
                    <div className="form-grid">
                      <p className="wide">Cadastre um aplicativo autenticador nesta conta de equipe. Não usamos SMS.</p>
                      <div className="form-actions">
                        <button className="primary" type="button" disabled={busy} onClick={onEnrollMfa}>
                          {busy ? "Gerando…" : "Gerar QR do autenticador"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="form-grid">
                      {mfaEnroll ? (
                        <>
                          <StaffMfaQr qrCode={mfaEnroll.qrCode} />
                          {mfaEnroll.secret ? (
                            <p className="wide admin-mfa-secret">
                              Chave manual (se não puder escanear o QR): <code>{mfaEnroll.secret}</code>
                            </p>
                          ) : null}
                        </>
                      ) : (
                        <p className="wide">Digite o código de 6 dígitos do autenticador já cadastrado.</p>
                      )}
                      <label className="wide">
                        Código do autenticador
                        <input
                          id="admin-totp"
                          name="totp"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          pattern="[0-9]{6}"
                          maxLength={6}
                          required
                          value={totpCode}
                          onChange={(event) => setTotpCode(event.target.value)}
                        />
                      </label>
                    </div>
                  )}
                </div>
                {error && (
                  <div className="form-alert" role="alert">
                    {error}
                  </div>
                )}
                {!needsEnroll ? (
                  <div className="form-actions">
                    <button className="primary" type="submit" disabled={busy}>
                      {busy ? "Confirmando…" : "Confirmar código"}
                    </button>
                  </div>
                ) : null}
              </form>
            </section>
          </div>
          <AdminSurfaceCurve />
        </main>
      );
    }
    return (
      <main id="conteudo" tabIndex={-1} className="admin-page">
        <div className="shell admin-auth-shell">
          <section className="admin-content">
            <div className="admin-title">
              <div>
                <span className="eyebrow">Área administrativa</span>
                <h1>Entrar para curadoria ou admin</h1>
                <p>Use o e-mail e a senha da sua conta de equipe GDG Jobs. Candidatos: acesse pelo <Link to="/login">Login</Link>.</p>
              </div>
            </div>
            <form className="admin-auth-form" onSubmit={onLogin}>
              <div className="form-section">
                <h2>Acesso</h2>
                <div className="form-grid">
                  <label className="wide">
                    E-mail
                    <input id="admin-email" name="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu-email@empresa.com" />
                  </label>
                  <label className="wide">
                    Senha
                    <input id="admin-password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                  </label>
                </div>
              </div>
              {error && (
                <div className="form-alert" role="alert">
                  {error}
                </div>
              )}
              <div className="form-actions">
                <button className="primary" type="submit" disabled={busy}>
                  {busy ? "Entrando…" : "Entrar"}
                </button>
              </div>
            </form>
          </section>
        </div>
        <AdminSurfaceCurve />
      </main>
    );
  }

  return (
    <main id="conteudo" tabIndex={-1} className="admin-page admin-workspace">
      <div className="shell admin-shell">
        <AdminNav profile={profile} />
        <section className="admin-content">
          <Outlet context={{ profile }} />
        </section>
      </div>
    </main>
  );
}
