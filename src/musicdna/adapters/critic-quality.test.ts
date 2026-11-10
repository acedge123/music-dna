import { describe,it,expect,vi } from "vitest";
import { measuredCritic } from "./critic-quality";
import { buildLedger } from "../engine/evidence";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

describe("critic telemetry failures",()=>{
  it.each(["choice","read","reveal","chat"] as const)("does not lose a safe %s reply when telemetry fails",async(stage)=>{
    const chain={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),maybeSingle:vi.fn().mockResolvedValue({data:null,error:{message:"unavailable"}})};
    const client={from:vi.fn().mockReturnValue(chain)} as unknown as SupabaseClient<Database>;
    const warn=vi.spyOn(console,"warn").mockImplementation(()=>{});
    const ledger=buildLedger([],[]);
    const generator=vi.fn().mockRejectedValue(new Error("writer failed"));
    const result=await measuredCritic(client,"u","s",ledger,{},generator,{stage,fallback:"safe response"},[]);
    expect(result.text).toBe("safe response");
    expect(warn).toHaveBeenCalledWith("[critic-quality] measurement_write_unavailable",stage);
    warn.mockRestore();
  });
  it("records deterministic choice without a new model call",async()=>{
    const client={from:()=>{throw Error("unavailable");}} as unknown as SupabaseClient<Database>;
    const generate=vi.fn();
    const result=await measuredCritic(client,"u","s",buildLedger([],[]),{},generate,{stage:"choice",savedText:"committed vote acknowledgement"},[]);
    expect(generate).not.toHaveBeenCalled();expect(result.validation_reason).toBe("deterministic_choice_no_model_call");
  });
});