import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Ledger } from "@/musicdna/engine/evidence";
import type { PublicRevealInput } from "@/musicdna/engine/reveal";
import { persistenceRpc } from "./persistence";
export type PublishedRead = {
 session_id:string; share_token:string; completed_at:string|null; lane:string|null;
 result_version:number; interpretation:string|null; archetype:PublicRevealInput["session"]["archetype"];
 content:Record<string,unknown>; evidence:Ledger;
};
export function publishedChoices(evidence:Ledger) {
 const seen=new Set<string>();
 return (evidence.axes??[]).filter(a=>a.eligible).flatMap(a=>a.supporting_examples).filter(e=>{
 const key=`${e.chosen}|${e.rejected}`; if(seen.has(key)) return false; seen.add(key); return true;
 }).slice(0,3).map(e=>({chosen:e.chosen,chosenArtist:e.chosen_artist,rejected:e.rejected,rejectedArtist:e.rejected_artist}));
}
export async function loadPublishedRead(client:SupabaseClient<Database>, token:string) {
 const read=await persistenceRpc<PublishedRead|null>(client,"lookup_published_read",{p_token:token});
 if(!read) return null;
 const {evidence,...safe}=read;
 return {...safe, defining_choices:publishedChoices(evidence)};
}
