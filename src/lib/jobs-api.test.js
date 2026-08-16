import { beforeEach, describe, expect, it, vi } from "vitest";

const fromMock = vi.fn();

vi.mock("./supabase-client.js", () => ({
  getSupabaseBrowserClient: () => ({
    from: fromMock,
  }),
}));

import { loadApprovedJobs } from "./jobs-api.js";

describe("loadApprovedJobs", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("pede apenas status approved e mapeia as linhas", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          id: "1",
          title: "Pessoa Desenvolvedora Front-end",
          description: "Fictícia",
          requirements: { mandatory: ["Testar"] },
          stack: ["React"],
          level: "mid",
          work_model: "remote",
          location: "Brasil",
          status: "approved",
          approved_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          companies: { name: "Nuvem Lauro Demo", description: "Demo" },
        },
      ],
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    fromMock.mockReturnValue({ select });

    const jobs = await loadApprovedJobs();

    expect(fromMock).toHaveBeenCalledWith("jobs");
    expect(eq).toHaveBeenCalledWith("status", "approved");
    expect(jobs).toHaveLength(1);
    expect(jobs[0].title).toBe("Pessoa Desenvolvedora Front-end");
    expect(jobs[0].level).toBe("Pleno");
  });
});
