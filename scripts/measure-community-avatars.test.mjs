import { describe, expect, it } from "vitest";
import {
  COMMUNITY_READ_BUDGET_PER_MINUTE,
  estimateListVisitBudget,
  estimatePrefetchWaves,
  classifyBudgetRisk,
} from "./lib/community-avatar-budget.mjs";

describe("community-avatar-budget model", () => {
  it("counts list RPCs plus one proxy per avatar prefetched", () => {
    const est = estimateListVisitBudget({ profilesOnPage: 24, withAvatars: 20 });
    expect(est.listRpc).toBe(2);
    expect(est.avatarProxies).toBe(20);
    expect(est.total).toBe(22);
    expect(est.remainingAfterVisit).toBe(COMMUNITY_READ_BUDGET_PER_MINUTE - 22);
  });

  it("computes prefetch waves from concurrency 6", () => {
    expect(estimatePrefetchWaves(0).waves).toBe(0);
    expect(estimatePrefetchWaves(12).waves).toBe(2);
    expect(estimatePrefetchWaves(24).waves).toBe(4);
  });

  it("classifies budget pressure", () => {
    expect(classifyBudgetRisk(10)).toBe("low");
    expect(classifyBudgetRisk(40)).toBe("moderate");
    expect(classifyBudgetRisk(52)).toBe("high");
    expect(classifyBudgetRisk(60)).toBe("over_limit");
  });
});
