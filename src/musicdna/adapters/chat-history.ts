import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { checkPersistence, PersistenceError } from "./persistence";
const Cursor = z.object({ created_at: z.string().datetime({ offset: true }), id: z.string().uuid() });
export function decodeChatCursor(value?: string | null) {
 if (!value) return null;
 try { return Cursor.parse(JSON.parse(decodeURIComponent(value))); }
 catch { throw new PersistenceError("INVALID_INPUT",400,"Invalid history cursor."); }
}
export function encodeChatCursor(row: {created_at: string; id: string}) { return encodeURIComponent(JSON.stringify(row)); }
export async function loadChatPage(client: SupabaseClient<Database>, userId: string, sessionId: string, cursor?: string | null, limit=200) {
 const {data: owned,error} = await client.from("sessions").select("user_id").eq("id",sessionId).maybeSingle();
 checkPersistence(error);
 if (!owned || owned.user_id!==userId) throw new PersistenceError("FORBIDDEN",403,"forbidden");
 const before=decodeChatCursor(cursor);
 let q=client.from("chat_messages").select("id,role,content,created_at,mutation_id").eq("session_id",sessionId).eq("user_id",userId)
 .order("created_at",{ascending:false}).order("id",{ascending:false});
 if(before) q=q.or(`created_at.lt.${before.created_at},and(created_at.eq.${before.created_at},id.lt.${before.id})`);
 const {data: rows,error: readError}=await q.limit(limit+1);
 checkPersistence(readError);
 const page=(rows??[]).slice(0,limit);
 const oldest=page.at(-1);
 const has_more=(rows?.length??0)>limit;
 return {messages:page.reverse(),has_more,next_cursor:has_more&&oldest?encodeChatCursor(oldest):null};
}
