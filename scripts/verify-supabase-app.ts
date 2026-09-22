import assert from "node:assert/strict";
import {loadEnvConfig} from "@next/env";
import {database} from "../src/supabase/database";
loadEnvConfig(process.cwd());
const base=process.env.IAP_VERIFY_URL??"http://127.0.0.1:3102";
async function main() {
 const health=await fetch(base+"/api/health");
 assert.equal((await health.json()).transport,"supabase");
 const expected=await database().snapshot(); assert.ok(expected.length);
 const page=await fetch(base); assert.equal(page.status,200);
 const html=await page.text(); assert.ok(html.includes(String(expected[0]!.cells[1])));
 for(const name of ["SUPABASE_IAP_SERVER_TOKEN","SUPABASE_SERVICE_ROLE_KEY","IAP_SYNC_TOKEN"])
  if(process.env[name])assert.equal(html.includes(process.env[name]!),false,"Server credential leaked into HTML");
 const reset=await fetch(base+"/api/test/reset",{method:"POST"});assert.equal(reset.status,404);
 const exportResponse=await fetch(base+"/api/export/"+encodeURIComponent(String(expected[0]!.cells[1]))+"?format=docx");
 assert.equal(exportResponse.status,200);
 const docx=new Uint8Array(await exportResponse.arrayBuffer());assert.equal(docx[0],80);assert.equal(docx[1],75);
 const gateway=(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)+"/functions/v1/iap-data";
 assert.equal((await fetch(gateway,{method:"POST",body:"{}"})).status,401);
 assert.equal((await fetch(gateway,{method:"POST",headers:{"x-iap-server-token":process.env.SUPABASE_IAP_SERVER_TOKEN??""},
  body:JSON.stringify({name:"iap_sync_config",payload:{}})})).status,403);
 console.log(JSON.stringify({app:"supabase",rows:expected.length,page:"passed",export:"passed",testReset:"blocked",credentials:"server-only",gateway:"restricted"}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
