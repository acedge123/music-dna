import { supabaseAdmin } from "@/integrations/supabase/client.server";
const { data } = await supabaseAdmin.from("song_facts").select("status,confidence,check_note").limit(5000);
const m:Record<string,number>={}; for(const r of data??[]){const k=`${r.status}|c${r.confidence}|${r.check_note?'note':''}`;m[k]=(m[k]??0)+1}
console.log(m);
