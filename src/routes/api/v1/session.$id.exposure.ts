import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { verifyBearer, HttpError } from "./_auth";
import { errorResponse, jsonResponse, preflightResponse } from "./_cors";
import { acknowledgeExposure } from "@/musicdna/adapters/exposure";
const Body = z.object({pairing_id:z.string().uuid(),exposure_id:z.string().uuid()}).strict();
export const Route = createFileRoute("/api/v1/session/$id/exposure")({server:{handlers:{
  OPTIONS:async()=>preflightResponse(),
  POST:async({request,params})=>{
    try {
      const sessionId=z.string().uuid().parse(params.id);
      const body=Body.parse(await request.json());
      const {supabase,userId}=await verifyBearer(request);
      return jsonResponse(await acknowledgeExposure(supabase,userId,sessionId,body.pairing_id,body.exposure_id,"rest"));
    }catch(e){
      if(e instanceof HttpError)return errorResponse(e.code,e.message,e.status);
      if(e instanceof z.ZodError)return errorResponse("INVALID_INPUT","Invalid exposure acknowledgement",400);
      return errorResponse("INVALID_INPUT","Exposure acknowledgement unavailable",400);
    }
  },
}}});