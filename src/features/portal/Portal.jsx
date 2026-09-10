import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, BriefcaseBusiness, Code2, Compass, Search, Sparkles, Users } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

export function Portal({ logged = false }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const searchJobs = (event) => {
    event.preventDefault();
    const trimmedQuery = query.trim();
    navigate(trimmedQuery ? `/vagas?query=${encodeURIComponent(trimmedQuery)}` : "/vagas");
  };

  return (
    <main className="portal-page">
      <section className="prototype-hero prototype-hero--portal portal-hero" aria-labelledby="portal-title">
        <div className="shell prototype-hero__portal-layout">
          <div className="prototype-hero__copy">
            <div className="eyebrow"><Compass size={15} /> Explore novas possibilidades</div>
            <h1 id="portal-title">Seu futuro em tech <em>tem endereço.</em></h1>
            <p>Encontre uma vaga, conheça a comunidade e dê forma ao próximo capítulo da sua carreira.</p>
            <form className="prototype-search" onSubmit={searchJobs} role="search">
              <Search size={18} aria-hidden="true" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cargo, tecnologia ou empresa" aria-label="Buscar vagas" />
              <button className="primary" type="submit">Buscar vagas <ArrowUpRight size={16} /></button>
            </form>
            <div className="prototype-hero__portal-note"><Sparkles size={15} /> Vagas selecionadas para a comunidade</div>
          </div>
          <div className="portal-avatar-wrap">
            <PortalAvatar />
          </div>
        </div>
      </section>
      {!logged && (
        <section className="cta portal-cta">
          <div className="shell cta-inner">
            <div>
              <div className="eyebrow light"><Users size={15} /> Pronto para o próximo passo</div>
              <h2>Quando a oportunidade chegar,<br />você vai estar preparado.</h2>
              <p>Crie seu perfil gratuito e deixe claro onde sua carreira quer chegar.</p>
            </div>
            <Link to="/login" className="white-button">Criar perfil gratuito <ArrowUpRight size={17} /></Link>
          </div>
        </section>
      )}
    </main>
  );
}

function PortalAvatar() {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
  const [portalOpen, setPortalOpen] = useState(false);
  const [videoRequested, setVideoRequested] = useState(false);
  const videoRef = useRef(null);
  const chips = [
    { icon: <BriefcaseBusiness size={15} />, label: "Front-end", className: "portal-chip--1" },
    { icon: <Code2 size={15} />, label: "React", className: "portal-chip--2" },
    { icon: <Compass size={15} />, label: "Remoto", className: "portal-chip--3" },
  ];

  const closePortal = useCallback(() => {
    setPortalOpen(false);
    videoRef.current?.pause();
  }, []);

  const requestVideo = () => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    setVideoRequested(true);
    setPortalOpen(true);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!videoRequested || !portalOpen || !video) return undefined;

    const startVideo = () => {
      try {
        video.currentTime = 0;
        video.play()?.catch(() => closePortal());
      } catch {
        closePortal();
      }
    };

    if (video.readyState >= 2) {
      startVideo();
    } else {
      video.addEventListener("loadeddata", startVideo, { once: true });
      video.load();
    }

    return () => video.removeEventListener("loadeddata", startVideo);
  }, [closePortal, portalOpen, videoRequested]);

  const handlePointerMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    setTilt({ x: y * -7, y: x * 9 });
  };

  return (
    <div
      className={`avatar-stage avatar-stage--portal ${portalOpen ? "is-portal-open" : ""}`}
      onPointerEnter={() => setActive(true)}
      onPointerLeave={(event) => { setActive(false); setTilt({ x: 0, y: 0 }); if (event.pointerType !== "touch") closePortal(); }}
      onPointerMove={handlePointerMove}
    >
      <div className="avatar-stage__halo" aria-hidden="true" />
      <div className="avatar-stage__grid" aria-hidden="true" />
      <div className="avatar-stage__orbit avatar-stage__orbit--one" aria-hidden="true" />
      <div className="avatar-stage__orbit avatar-stage__orbit--two" aria-hidden="true" />
      <div className="portal-video" aria-hidden="true">
        {videoRequested && (
          <video
            ref={videoRef}
            className="portal-video__media"
            src="/gdg-video-avatar.mp4"
            poster="/avatar-gdgjobs.png"
            muted
            playsInline
            preload="none"
            onEnded={closePortal}
            onError={closePortal}
          />
        )}
      </div>
      <img
        className={`avatar-stage__image ${active ? "is-active" : ""}`}
        src="/avatar-gdgjobs.png"
        alt="Avatar do GDG Jobs com notebook"
        style={{ "--tilt-x": `${tilt.x}deg`, "--tilt-y": `${tilt.y}deg` }}
      />
      {chips.map((chip) => <span className={`portal-chip ${chip.className}`} key={chip.label}>{chip.icon}{chip.label}</span>)}
      <span className="avatar-stage__badge avatar-stage__badge--top"><Code2 size={14} /> Tech</span>
      <span className="avatar-stage__badge avatar-stage__badge--bottom"><Users size={14} /> Comunidade</span>
      <button
        className="portal-video-hint"
        type="button"
        onClick={(event) => { event.stopPropagation(); requestVideo(); }}
        onBlur={closePortal}
        aria-label="Abrir o portal animado do GDG Jobs"
      >
        Abra o portal <ArrowUpRight size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
