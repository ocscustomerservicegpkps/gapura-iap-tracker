import { SupabaseDatabase } from "./database.ts";
import { syncOnce } from "./worker.ts";
import { GoogleMirror } from "./google-mirror.ts";
Deno.serve(async (request) => {
 const db=new SupabaseDatabase(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
 try {
  const config=await db.rpc<any>("iap_sync_config",{p_token:request.headers.get("x-iap-sync-token")??""});
  if(!config) return new Response("Unauthorized",{status:401});
  const result=await syncOnce(db,new GoogleMirror(config),config.tab);
  return Response.json(result);
 } catch(error) {
  console.error(error instanceof Error?error.message:"Sync failed");
  return Response.json({ok:false,error:"Sinkronisasi gagal; lihat iap_sync_state.last_error."},{status:500});
 }
});
