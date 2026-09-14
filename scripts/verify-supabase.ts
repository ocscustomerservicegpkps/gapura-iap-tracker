import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { database } from "../src/supabase/database";
loadEnvConfig(process.cwd());
const db=database(),id="__IAP_VERIFY_" + randomUUID(),today="2026-09-14";
const input={step:"Temporary test",action:"Temporary test",pic:"A",timeline:"",targetDate:"9 Sep 2026",
 status:"Belum Dimulai",progress:0,actualDate:"",evidence:"",evidenceLink:""};
const context={iapId:id,incident:"Incident",parties:"",purpose:"",effectiveDate:"",rootCause:"",kpis:["KPI"]};
const mutate=(p_operation:string,p_payload:unknown)=>db.rpc("iap_mutate",{p_operation,p_payload,p_today:today});
async function main(){
 let created = false;
 try{
  await mutate("create_case",{iapId:id,title:"Temporary test",station:"TEST",steps:[input],context});
  created = true;
  await mutate("create_step",{iapId:id,input});
  await mutate("update_step",{iapId:id,stepNo:1,input:{...input,pic:"B"}});
  await mutate("append_evidence",{keys:[{iapId:id,stepNo:1},{iapId:id,stepNo:2}],link:"https://example.com/evidence"});
  const rows=(await db.snapshot()).filter(r=>r.cells[1]===id);
  assert.equal(rows.length,2);assert.equal(rows[0]!.cells[7],"B");
  assert.equal(rows[0]!.cells[13],"TERLAMBAT");assert.equal(rows[0]!.cells[17],"Incident");
  assert.equal(rows[1]!.cells[16],"https://example.com/evidence");
  await mutate("delete_step",{iapId:id,stepNo:2});
  console.log("Live gateway CRUD and evidence transaction passed.");
 }finally{
  if (created) await mutate("delete_case",{iapId:id});
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
