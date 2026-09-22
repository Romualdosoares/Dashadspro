import { describe, expect, it } from "vitest";
import { buildPipelineColumns } from "../lib/crm-pipeline";

describe("buildPipelineColumns", () => {
  it("orders stages and groups only leads in the current pipeline", () => {
    const columns = buildPipelineColumns(
      [
        { id: "stage-won", name: "Fechado", position: 2 },
        { id: "stage-new", name: "Novo", position: 1 },
      ],
      [
        {
          id: "lead-1",
          contact_id: "contact-1",
          stage_id: "stage-won",
          source: "manual",
          status: "open",
          contact_name: "Ana Souza",
          contact_phone: null,
          contact_email: "ana@example.com",
          created_at: "2026-09-21T10:00:00.000Z",
          updated_at: "2026-09-21T10:00:00.000Z",
        },
        {
          id: "lead-2",
          contact_id: "contact-2",
          stage_id: "removed-stage",
          source: "whatsapp",
          status: "open",
          contact_name: "Bruno Lima",
          contact_phone: "5511999999999",
          contact_email: null,
          created_at: "2026-09-21T11:00:00.000Z",
          updated_at: "2026-09-21T11:00:00.000Z",
        },
      ],
    );

    expect(columns.map(({ stage, leads }) => [stage.id, leads.map((lead) => lead.id)])).toEqual([
      ["stage-new", []],
      ["stage-won", ["lead-1"]],
    ]);
  });
});
