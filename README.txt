DAILY EARN — STARTER PROJECT
============================

This is a first deployable starter, not yet a production cash-rewards platform.
It includes a Telegram Mini App UI, Cloudflare Worker API, Telegram initData validation,
Supabase schema, and a server-side daily check-in. Monetag ad rewards and cash payouts
remain disabled until their real provider setup and verification callbacks are configured.

FILES
-----
public/index.html, styles.css, app.js  Mini App frontend
worker/index.js                       Cloudflare Worker API
supabase/schema.sql                   Database schema and daily check-in RPC
wrangler.toml                         Cloudflare Workers configuration

PHONE SETUP
-----------
1. Install/use Termux and confirm Node.js is available:
   pkg update && pkg install nodejs git
2. Create a project folder and unzip this package there.
3. Install Wrangler:
   npm install -g wrangler
4. Sign in:
   npx wrangler login
5. Create a Supabase project at https://supabase.com and open SQL Editor.
6. Paste and run supabase/schema.sql.
7. In Cloudflare Worker secrets, set:
   BOT_TOKEN = token from BotFather (keep secret)
   SUPABASE_URL = your Supabase project URL
   SUPABASE_SERVICE_ROLE_KEY = Supabase service_role key (keep secret)
   Never place these values in public/app.js or send them in chat.
8. Edit wrangler.toml name if desired. Deploy from the project root:
   npx wrangler deploy
9. In BotFather, create the dedicated bot and configure its Mini App URL to the
   deployed HTTPS URL. Use a short bot username without the @ in public/app.js:
   window.DAILYEARN_BOT_USERNAME = "YourBotUsername";
   This value is public and is not a secret.
10. Open the Mini App from Telegram to test authentication and daily check-in.

IMPORTANT IMPLEMENTATION NOTES
------------------------------
- This starter validates Telegram WebApp initData on the server.
- Current starter endpoints: GET /api/health, GET /api/me, POST /api/checkin.
- Daily check-in awards 100 POINTS, not cash. Change only after testing and policy review.
- The Supabase service role is server-only and must be stored as a Cloudflare secret.
- The UI does NOT award points when the ad button is tapped.
- Monetag: open your Monetag Telegram Mini App dashboard and obtain the current official
  integration instructions / app placement code. Add the official SDK and configure a
  server-verified postback before enabling any ad reward. Do not trust a frontend callback
  alone to credit points. Exact placement code is account-specific.
- Withdrawals are intentionally not enabled. Before enabling real payouts, add admin
  authentication, reserve funds, eligibility rules, duplicate-request protection, review
  workflow, and actual payment-provider integration.
- Do not ask users to click ads. Rewarded ads must be opt-in and compliant with Monetag's
  current policies.
