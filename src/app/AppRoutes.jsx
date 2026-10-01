import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Admin } from "../Admin.jsx";
import { Home } from "../features/catalog/Home.jsx";
import { EventosIndex } from "../features/events/Eventos.jsx";
import { CommunityRoute } from "../features/community/Community.jsx";
import { Newsletter } from "../features/newsletter/Newsletter.jsx";
import { Portal } from "../features/portal/Portal.jsx";
import { adminChildRoutes } from "../features/admin/admin-routes.jsx";
import { JobDetailRoute } from "../features/jobs/JobDetailRoute.jsx";
import { CatalogGate, EventLandingRoute } from "./routes/CatalogGate.jsx";
import { LoginRoute } from "./routes/LoginRoute.jsx";
import { MyApplicationsRoute } from "./routes/MyApplicationsRoute.jsx";
import { OnboardingRoute } from "./routes/OnboardingRoute.jsx";
import { PrivacyPreferencesRoute } from "./routes/PrivacyPreferencesRoute.jsx";
import { ProfileEditRoute } from "./routes/ProfileEditRoute.jsx";

/** Wiring das rotas. Guards ficam nos componentes de rota; aqui não há regra nova. */
export function AppRoutes({ auth, setAuth, authReady, hydratedUserId, hydrateFailedUserId, sessionUserId }) {
  const logged = Boolean(auth.session);
  const userId = auth.session?.user?.id;
  return (
    <Routes>
      <Route path="/" element={<CatalogGate auth={auth}><Portal logged={logged} profile={auth.profile} email={auth.session?.user?.email} /></CatalogGate>} />
      <Route path="/vagas" element={<CatalogGate auth={auth}><Home logged={logged} /></CatalogGate>} />
      <Route path="/eventos" element={<CatalogGate auth={auth}><EventosIndex logged={logged} /></CatalogGate>} />
      <Route path="/eventos/:slug" element={<CatalogGate auth={auth}><EventLandingRoute /></CatalogGate>} />
      <Route path="/comunidade" element={<CommunityRoute auth={auth} authReady={authReady} />} />
      <Route path="/comunidade/:publicId" element={<CommunityRoute auth={auth} authReady={authReady} />} />
      <Route path="/newsletter" element={<CatalogGate auth={auth}><Newsletter logged={logged} /></CatalogGate>} />
      <Route path="/jobs/:id" element={<CatalogGate auth={auth}><JobDetailRoute logged={logged} userId={userId} needsOnboarding={auth.needsOnboarding} authReady={authReady} profile={auth.profile} /></CatalogGate>} />
      <Route path="/minhas-candidaturas" element={<MyApplicationsRoute auth={auth} authReady={authReady} />} />
      <Route path="/preferencias" element={<PrivacyPreferencesRoute auth={auth} authReady={authReady} />} />
      <Route path="/perfil" element={<ProfileEditRoute auth={auth} authReady={authReady} setAuth={setAuth} />} />
      <Route path="/onboarding" element={auth.needsOnboarding ? <OnboardingRoute auth={auth} setAuth={setAuth} sessionUserId={sessionUserId} /> : <Navigate to="/" replace />} />
      <Route path="/login" element={<LoginRoute auth={auth} />} />
      <Route path="/admin" element={<Admin session={auth.session} authProfile={auth.profile} authReady={authReady} profileHydrated={hydratedUserId === (userId ?? null)} profileHydrateFailed={Boolean(userId) && hydrateFailedUserId === userId} />}>
        {adminChildRoutes}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
