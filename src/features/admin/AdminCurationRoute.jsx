import React from "react";
import { useOutletContext } from "react-router-dom";
import { CurationQueue } from "../curation/CurationQueue.jsx";
import { canManageAdminJobs } from "./staff-access.js";

export function AdminCurationRoute() {
  const { profile } = useOutletContext();
  return <CurationQueue profile={profile} includeRejected={canManageAdminJobs(profile?.role)} />;
}
