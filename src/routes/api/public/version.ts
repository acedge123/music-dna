import { createFileRoute } from "@tanstack/react-router";
export const Route=createFileRoute("/api/public/version")({server:{handlers:{GET:async()=>{
 const sha=process.env.VERCEL_GIT_COMMIT_SHA;
 const servingSha=sha&&/^[0-9a-f]{40}$/i.test(sha)?sha:null;
 return new Response(JSON.stringify({serving_sha:servingSha,persistence_v2:process.env.MUSICDNA_BACKEND_PERSISTENCE_V2==="1"}),{headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
}}});
