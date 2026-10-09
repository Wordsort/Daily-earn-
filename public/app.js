window.DAILYEARN_BOT_USERNAME = "DailyEarn247Bot";
/* DailyEarn starter frontend.
   Real balances come only from the backend. Never put bot tokens or database secrets here. */
const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }
const $ = (id) => document.getElementById(id);
const state = { profile: null, transactions: [], loading: false };
const apiBase = ""; // same-origin Cloudflare Worker
function notice(title, message) { $("notice").innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span>`; }
function escapeHtml(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function initData() { return tg?.initData || ""; }
async function api(path, body) {
  const res = await fetch(apiBase + path, { method: body ? "POST" : "GET", headers: {"Content-Type":"application/json","Authorization":"tma " + initData()}, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
function render() {
  const p = state.profile;
  $("hello").textContent = p?.first_name ? `Welcome, ${p.first_name} 👋` : "Welcome 👋";
  $("balance").textContent = Number(p?.points || 0).toLocaleString();
  $("energy").textContent = `${p?.energy ?? 5} / 5`;
  $("energybar").style.width = `${Math.max(0,Math.min(100,(p?.energy ?? 5)*20))}%`;
  $("streak").textContent = p?.streak || 0;
  $("status").textContent = p?.connected ? "Account connected" : "Preview mode";
  $("claimBtn").disabled = state.loading || !!p?.claimed_today || !p?.connected;
  $("claimBtn").textContent = p?.claimed_today ? "Claimed" : "Claim";
  const tx = state.transactions;
  $("transactions").innerHTML = tx.length ? tx.map(t => `<div class="tx"><div>${escapeHtml(t.label)}<small>${escapeHtml(new Date(t.created_at).toLocaleDateString())}</small></div><strong>+${Number(t.amount).toLocaleString()}</strong></div>`).join("") : '<div class="empty">Your confirmed activity will appear here.</div>';
}
async function load() {
  if (!initData()) {
    state.profile = { first_name: "there", points: 0, energy: 5, streak: 0, connected: false };
    render();
    notice("Open from Telegram", "This is a preview. Open the app from your DailyEarn bot after deployment to connect your account.");
    return;
  }
  try {
    const data = await api("/api/me");
    state.profile = data.profile; state.transactions = data.transactions || []; render();
    notice("You're connected", "Your account is ready. Reward features activate after the backend and Monetag verification are configured.");
  } catch (e) { notice("Setup required", e.message + ". Check Worker secrets and database setup."); }
}
$("claimBtn").addEventListener("click", async () => {
  state.loading = true; render();
  try { const d = await api("/api/checkin", {}); state.profile = d.profile; state.transactions = d.transactions || state.transactions; render(); notice("Check-in successful", "Your points were added by the server."); }
  catch(e) { notice("Couldn't claim", e.message); }
  finally { state.loading = false; render(); }
});
$("adBtn").addEventListener("click", () => {
  notice("Ads not activated yet", "Add your Telegram Mini App ad code/placement in the Monetag dashboard first. We won't award points for a button tap.");
});
$("shareBtn").addEventListener("click", async () => {
  const username = window.DAILYEARN_BOT_USERNAME || "";
  if (!username) { notice("Bot link not set", "After creating your bot, set DAILYEARN_BOT_USERNAME in app.js."); return; }
  const ref = state.profile?.referral_code || "";
  const link = `https://t.me/${username}?startapp=ref_${encodeURIComponent(ref)}`;
  if (tg?.openTelegramLink) tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent("Join me on DailyEarn!")}`);
  else if (navigator.clipboard) { await navigator.clipboard.writeText(link); notice("Invite link copied", link); }
  else notice("Your invite link", link);
});
const screens = {
  home: $("homeScreen"),
  earn: $("earnScreen"),
  refer: $("referScreen"),
  wallet: $("walletScreen")
};

document.querySelectorAll(".nav-item").forEach(button => {
  button.addEventListener("click", () => {
    const tab = button.dataset.tab;

    Object.entries(screens).forEach(([name, screen]) => {
      if (screen) screen.hidden = name !== tab;
    });

    document.querySelectorAll(".nav-item").forEach(item => {
      item.classList.toggle("active", item === button);
    });

    window.scrollTo({ top: 0, behavior: "smooth" });

    const messages = {
      home: ["Home", "Your points and daily activities are shown here."],
      earn: ["Earn", "Choose an activity. Monetag rewards are not active yet."],
      refer: ["Refer", "Invite friends using your personal Telegram referral link."],
      wallet: ["Wallet", "Review your points. Withdrawals are not enabled yet."]
    };

    if (typeof notice === "function" && messages[tab]) {
      notice(messages[tab][0], messages[tab][1]);
    }
  });
});

$("earnClaimBtn")?.addEventListener("click", () => $("claimBtn")?.click());
$("earnAdBtn")?.addEventListener("click", () => $("adBtn")?.click());
$("referShareBtn")?.addEventListener("click", () => $("shareBtn")?.click());

load();