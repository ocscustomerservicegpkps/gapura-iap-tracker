import { GoogleQuota } from "./google-quota.ts";
type Config = { spreadsheetId: string; clientEmail: string; privateKey: string; tab: string };
const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
const encode = (s: string) => base64url(new TextEncoder().encode(s));
export class GoogleMirror {
 private deadline = Date.now() + 180_000;
 private token = ""; private expiry = 0; private quota = new GoogleQuota();
 constructor(private config: Config) {}
 private async accessToken() {
  if (Date.now() < this.expiry) return this.token;
  const now = Math.floor(Date.now()/1000);
  const unsigned = encode(JSON.stringify({alg:"RS256",typ:"JWT"}))+"."+encode(JSON.stringify({
   iss:this.config.clientEmail,scope:"https://www.googleapis.com/auth/spreadsheets",
   aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3600}));
  const pem = this.config.privateKey.replace(/\\n/g,"\n").replace(/-----[^-]+-----/g,"").replace(/\s/g,"");
  const bytes = Uint8Array.from(atob(pem),c=>c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8",bytes,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,new TextEncoder().encode(unsigned)));
  const response = await fetch("https://oauth2.googleapis.com/token",{method:"POST",
   headers:{"Content-Type":"application/x-www-form-urlencoded"},
   body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:unsigned+"."+base64url(signature)}),
   signal:AbortSignal.timeout(20_000)});
  if (!response.ok) throw new Error("Google OAuth gagal ("+response.status+")");
  const data = await response.json();
  this.token=data.access_token; this.expiry=Date.now()+(data.expires_in-60)*1000; return this.token;
 }
 private async request(kind:"read"|"write",path:string,body?:unknown):Promise<any> {
  return this.quota.run(kind,async()=>{
   if(Date.now() >= this.deadline) throw new Error("Google mirror deadline exceeded; retry next cycle");
   const token=await this.accessToken();
   const response=await fetch("https://sheets.googleapis.com/v4/spreadsheets/"+this.config.spreadsheetId+path,{
    method:body?"POST":"GET",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
    ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(Math.max(1, Math.min(25_000, this.deadline-Date.now())))});
   if(!response.ok) {
    if(response.status===401) this.expiry=0;
    throw Object.assign(new Error("Google Sheets gagal ("+response.status+")"),{response});
   }
   return response.json();
  });
 }
 async readRange(range:string):Promise<string[][]> {
  const data=await this.request("read","/values/"+encodeURIComponent(range)+"?valueRenderOption=FORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING");
  return (data.values??[]).map((r:unknown[])=>r.map(c=>String(c??"")));
 }
 async writeRanges(updates:readonly {range:string;values:(string|number)[][]}[]) {
  if (!updates.length) return;
  const metadata=await this.request("read","?fields=sheets.properties");
  const tab=metadata.sheets.find((s:any)=>s.properties.title===this.config.tab)?.properties;
  if(!tab) throw new Error("Tracker tab tidak ditemukan");
  const required=Math.max(...updates.map(u=>Number(u.range.match(/(\d+)(?::[A-Z]+\d+)?$/)?.[1]??0)));
  const requests=[];
  if(required>tab.gridProperties.rowCount) requests.push({appendDimension:{
   sheetId:tab.sheetId,dimension:"ROWS",length:required-tab.gridProperties.rowCount}});
  for(const u of updates) {
   const m=u.range.match(/!([A-Z]+)(\d+)/);
   if(!m) throw new Error("Range tidak valid");
   const col=[...m[1]!].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)-1;
   requests.push({updateCells:{start:{sheetId:tab.sheetId,rowIndex:Number(m[2])-1,columnIndex:col},
    rows:u.values.map(r=>({values:r.map(c=>({userEnteredValue:typeof c==="number"?{numberValue:c}:{stringValue:c}}))})),
    fields:"userEnteredValue"}});
  }
  // One atomic batch, including grid expansion; bounded payloads leave headroom below Google's 2 MB recommendation.
  const body={requests};
  if(new TextEncoder().encode(JSON.stringify(body)).length>1_800_000)
   throw new Error("Payload mirror terlalu besar; bagi tracker sebelum menjalankan sinkronisasi.");
  await this.request("write",":batchUpdate",body);
 }
}
