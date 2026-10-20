import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

export class PersistenceError extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function checkPersistence(error: { message: string; code?: string } | null) {
  if (!error) return;
  if (error.message.includes("MUTATION_CONFLICT"))
    throw new PersistenceError(
      "MUTATION_CONFLICT",
      409,
      "Mutation ID already used for a different submission.",
    );
  if (error.code === "42501") throw new PersistenceError("FORBIDDEN", 403, "forbidden");
  if (error.message.includes("INVALID_RESULT_VERSION"))
    throw new PersistenceError("INVALID_RESULT_VERSION", 400, "Saved result version not found.");
  if (error.message.includes("CHAT_LEASE_LOST"))
    throw new PersistenceError(
      "CHAT_TURN_PENDING",
      409,
      "Another request is recovering this turn; retry the same mutation ID.",
    );
  throw new PersistenceError(
    "PERSISTENCE_FAILED",
    500,
    "The operation was not saved. Retry with the same mutation ID.",
  );
}
// Generated schema can lag unapplied review-only migrations. This typed extension
// defines only the new RPC boundary; it does not weaken ordinary table types.
type RpcArgs = {
  save_result_feedback: { p_session_id: string; p_payload: Json };
  begin_chat_turn: { p_session_id: string; p_mutation_id: string; p_message: string };
  complete_chat_turn: {
    p_session_id: string;
    p_mutation_id: string;
    p_lease_token: string;
    p_reply: string;
    p_refinement: Json;
  };
  release_chat_turn: { p_session_id: string; p_mutation_id: string; p_lease_token: string };
  publish_saved_read: { p_session_id: string; p_publish: boolean; p_version: number | null };
  lookup_published_read: { p_token: string };
};
export async function persistenceRpc<T>(
  client: SupabaseClient<Database>,
  name: keyof RpcArgs,
  args: RpcArgs[keyof RpcArgs],
): Promise<T> {
  const rpc = client.rpc.bind(client) as unknown as (
    name: keyof RpcArgs,
    args: RpcArgs[keyof RpcArgs],
  ) => PromiseLike<{ data: T; error: { message: string; code?: string } | null }>;
  const { data, error } = await rpc(name, args);
  checkPersistence(error);
  return data;
}
