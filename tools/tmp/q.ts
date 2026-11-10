import { supabaseAdmin } from "@/integrations/supabase/client.server";
const { data: u } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
const alan = u.users.find((x) => x.email === "alan@thegig.agency")!;
const { data, error } = await supabaseAdmin.from("song_facts")
  .update({ status: "approved", reviewed_by: alan.id, reviewed_at: new Date().toISOString() })
  .eq("status", "draft").select("id");
console.log(error?.message, data?.length);
