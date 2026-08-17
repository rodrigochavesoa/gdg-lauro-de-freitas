import React, { useState } from "react";
import { Check } from "lucide-react";
import { saveOnboardingProfile } from "./auth-api.js";
import { profilePreferences } from "./profile-completeness.js";

const LEVEL_OPTIONS = [
  { value: "intern", label: "Estágio" },
  { value: "junior", label: "Júnior" },
  { value: "mid", label: "Pleno" },
  { value: "senior", label: "Sênior" },
];

const MODEL_OPTIONS = [
  { value: "remote", label: "Remoto" },
  { value: "hybrid", label: "Híbrido" },
  { value: "onsite", label: "Presencial" },
];

export function Onboarding({ profile, email, onSaved }) {
  const prefs = profilePreferences(profile);
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [experienceLevel, setExperienceLevel] = useState(prefs.experience_level ?? "");
  const [skillsText, setSkillsText] = useState((profile?.skills ?? []).join(", "));
  const [location, setLocation] = useState(prefs.location ?? "");
  const [workModel, setWorkModel] = useState(prefs.work_model ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [linkedin, setLinkedin] = useState(prefs.linkedin ?? "");
  const [github, setGithub] = useState(prefs.github ?? "");
  const [cvUrl, setCvUrl] = useState(prefs.cv_url ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const saved = await saveOnboardingProfile({
        fullName,
        experienceLevel,
        skillsText,
        location,
        workModel,
        bio,
        linkedin,
        github,
        cvUrl,
      });
      onSaved(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="admin-page">
      <section className="admin-content">
        <div className="admin-title">
          <div>
            <span className="eyebrow">Perfil mínimo</span>
            <h1>Complete seus dados para usar o GDGJobs</h1>
            <p>
              Nome, nível, tecnologias e localidade/modalidade são obrigatórios na homologação (D-01).
              E-mail vem da conta Google. Isto não é um fluxo de consentimento LGPD.
            </p>
          </div>
        </div>
        <form className="job-form" onSubmit={onSubmit}>
          <div className="form-section">
            <h2>Obrigatório</h2>
            <div className="form-grid">
              <label className="wide">
                Nome
                <input required value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </label>
              <label className="wide">
                E-mail
                <input type="email" value={email ?? ""} readOnly />
              </label>
              <label>
                Nível
                <select required value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value)}>
                  <option value="">Selecione</option>
                  {LEVEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Modalidade
                <select required value={workModel} onChange={(e) => setWorkModel(e.target.value)}>
                  <option value="">Selecione</option>
                  {MODEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="wide">
                Tecnologias (separe por vírgula)
                <input
                  required
                  value={skillsText}
                  onChange={(e) => setSkillsText(e.target.value)}
                  placeholder="React, TypeScript"
                />
              </label>
              <label className="wide">
                Localidade
                <input
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Brasil · Remoto"
                />
              </label>
            </div>
          </div>
          <div className="form-section">
            <h2>Opcional</h2>
            <div className="form-grid">
              <label className="wide">
                Bio
                <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows="3" />
              </label>
              <label>
                LinkedIn
                <input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://" />
              </label>
              <label>
                GitHub
                <input value={github} onChange={(e) => setGithub(e.target.value)} placeholder="https://" />
              </label>
              <label className="wide">
                Currículo (URL)
                <input value={cvUrl} onChange={(e) => setCvUrl(e.target.value)} placeholder="https://" />
              </label>
            </div>
          </div>
          {error && (
            <div className="success" role="alert">
              {error}
            </div>
          )}
          <div className="form-actions">
            <button className="primary" type="submit" disabled={busy}>
              <Check size={17} /> {busy ? "Salvando…" : "Salvar perfil"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
