import React from "react";
import { Navigate, Route } from "react-router-dom";
import { AdminCurationRoute } from "./AdminCurationRoute.jsx";
import { AdminHome } from "./AdminHome.jsx";
import { AdminJobDetailRoute } from "./AdminJobDetailRoute.jsx";
import { AdminJobFormRoute } from "./AdminJobFormRoute.jsx";
import { AdminJobsGate } from "./AdminJobsGate.jsx";
import { AdminIngestRoute } from "./AdminIngestRoute.jsx";
import { AdminJobsRoute } from "./AdminJobsRoute.jsx";

export const adminChildRoutes = (
  <>
    <Route index element={<AdminHome />} />
    <Route path="curadoria" element={<AdminCurationRoute />} />
    <Route path="ingestao" element={<AdminJobsGate />}>
      <Route index element={<AdminIngestRoute />} />
    </Route>
    <Route path="vagas" element={<AdminJobsGate />}>
      <Route index element={<AdminJobsRoute />} />
      <Route path="nova" element={<AdminJobFormRoute />} />
      <Route path=":id" element={<AdminJobDetailRoute />} />
    </Route>
    <Route path="*" element={<Navigate to="/admin" replace />} />
  </>
);
