const fs=require("fs");
const path=require("path");
const root=path.join(process.cwd(),"supabase/functions/iap-google-mirror");
for(const source of ["src/supabase/database.ts","src/sync/worker.ts","src/sync/reconcile.ts","src/sync/google-quota.ts"]){
 const content=fs.readFileSync(source,"utf8").replace(/from "\.\.\/supabase\/database"/g,'from "./database.ts"')
 .replace(/from "\.\/reconcile"/g,'from "./reconcile.ts"');
 fs.writeFileSync(path.join(root,path.basename(source)),content);
}
console.log("Shared mirror sources copied for Edge deployment.");
