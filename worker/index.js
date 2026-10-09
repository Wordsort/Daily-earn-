const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Content-Type": "application/json; charset=utf-8"
};
const json = (data, status=200) => new Response(JSON.stringify(data), {status, headers:cors});
export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null,{headers:cors});
    const url = new URL(request.url);
    if (url.pathname === "/api/health") return json({ok:true, service:"DailyEarn API", mode:"starter"});
    if (!url.pathname.startsWith("/api/")) return env.ASSETS ? env.ASSETS.fetch(request) : new Response("DailyEarn API");
    const initData = (request.headers.get("Authorization") || "").replace(/^tma\s+/i,"");
    const user = await validateTelegramInitData(initData, env.BOT_TOKEN);
    if (!user) return json({error:"Telegram authentication failed. Open this app from its Telegram bot."},401);
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return json({error:"Database secrets are not configured yet."},503);
    try {
      const profile = await upsertUser(user, env);
      if (url.pathname === "/api/me" && request.method === "GET") {
        const transactions = await supabase(env, `/rest/v1/transactions?user_id=eq.${profile.id}&select=label,amount,created_at&order=created_at.desc&limit=10`);
        return json({profile,transactions});
      }
      if (url.pathname === "/api/checkin" && request.method === "POST") {
        const result = await supabase(env, "/rest/v1/rpc/claim_daily_checkin", "POST", {p_user_id:profile.id});
        if (!result || result.error) return json({error:result?.message || "Check-in could not be claimed."},400);
        const refreshed = await upsertUser(user, env);
        const transactions = await supabase(env, `/rest/v1/transactions?user_id=eq.${refreshed.id}&select=label,amount,created_at&order=created_at.desc&limit=10`);
        return json({profile:refreshed,transactions});
      }
      return json({error:"Endpoint not found"},404);
    } catch (e) {
      return json({error:"Server error. Check Supabase schema and Worker secrets."},500);
    }
  }
};
async function validateTelegramInitData(initData, botToken) {
  if (!initData || !botToken) return null;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash"); if (!hash) return null;
    params.delete("hash");
    const authDate = Number(params.get("auth_date"));
    if (!authDate || Math.abs(Date.now()/1000-authDate)>86400) return null;
    const check = [...params.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join("\n");
    const enc = new TextEncoder();
    const secretKey = await crypto.subtle.importKey("raw",enc.encode("WebAppData"),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
    const secret = await crypto.subtle.sign("HMAC",secretKey,enc.encode(botToken));
    const key = await crypto.subtle.importKey("raw",secret,{name:"HMAC",hash:"SHA-256"},false,["sign"]);
    const signature = new Uint8Array(await crypto.subtle.sign("HMAC",key,enc.encode(check)));
    const actual = [...signature].map(b=>b.toString(16).padStart(2,"0")).join("");
    if (!constantTimeEqual(actual,hash)) return null;
    const parsed = JSON.parse(params.get("user") || "null");
    if (!parsed?.id) return null;
    return {id:String(parsed.id),username:parsed.username||null,first_name:parsed.first_name||"Player"};
  } catch { return null; }
}
function constantTimeEqual(a,b) { if(a.length!==b.length)return false; let out=0; for(let i=0;i<a.length;i++)out|=a.charCodeAt(i)^b.charCodeAt(i); return out===0; }
async function supabase(env,path,method="GET",body) {
  const res=await fetch(env.SUPABASE_URL+path,{method,headers:{"apikey":env.SUPABASE_SERVICE_ROLE_KEY,"Authorization":"Bearer "+env.SUPABASE_SERVICE_ROLE_KEY,"Content-Type":"application/json","Prefer":"return=representation"},body:body?JSON.stringify(body):undefined});
  const data=await res.json().catch(()=>null);
  if(!res.ok) throw new Error("Supabase request failed");
  return data;
}
async function upsertUser(user,env) {
  const rows=await supabase(env,"/rest/v1/users?on_conflict=telegram_id","POST",{telegram_id:user.id,username:user.username,first_name:user.first_name});
  // Prefer the returned row. If upsert response is empty, select by Telegram ID.
  const row=Array.isArray(rows)&&rows[0];
  if(row)return row;
  const found=await supabase(env,`/rest/v1/users?telegram_id=eq.${encodeURIComponent(user.id)}&select=*`);
  if(!Array.isArray(found)||!found[0])throw new Error("Could not load user");
  return found[0];
}