import { matchJobsGate } from "./handler.ts";

// SEC-MATCH-JOBS-PRIVACY-01: a ausência de chamada na SPA não é controle.
Deno.serve((request) => matchJobsGate(request));
