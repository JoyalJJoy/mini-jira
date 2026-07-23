#!/usr/bin/env zsh
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
SECRET_KEY="4cc18b30189a089313b88b56a582652b0e15b0b13eaa112b624a22462741ff4f"

echo "============================================"
echo "  Deploy Mini Jira to Production"
echo "============================================"
echo ""

# ─── Step 1: Check flyctl ──────────────────────────
if ! command -v flyctl &>/dev/null && ! command -v fly &>/dev/null; then
  echo "❌ flyctl not found. Install it first:"
  echo "   brew install flyctl"
  echo "   Then run: fly auth login"
  exit 1
fi
FLY="$(command -v flyctl || command -v fly)"
echo "✅ flyctl found: $FLY"

# ─── Step 2: Check auth ──────────────────────────
echo ""
echo ">>> Checking Fly.io authentication..."
$FLY auth whoami 2>/dev/null || {
  echo "❌ Not logged in. Run: fly auth login"
  exit 1
}

# ─── Step 3: Create Upstash Redis ──────────────────
echo ""
echo "============================================"
echo "  IMPORTANT: Set up Upstash Redis"
echo "============================================"
echo ""
echo "1. Go to https://console.upstash.com/redis"
echo "2. Create a free Redis database"
echo "3. Copy the REST URL (redis://default:...)"
echo "4. You'll need it in step 5 below."
echo ""
read -p "Press Enter after you have the Upstash Redis URL... " REDIS_URL_INPUT
if [ -z "$REDIS_URL_INPUT" ]; then
  echo "❌ Redis URL is required. Run this script again when you have it."
  exit 1
fi
echo "✅ Redis URL saved."

# ─── Step 4: Deploy users service ──────────────────
echo ""
echo ">>> Deploying users service..."
cd "$ROOT/services/users"
$FLY launch --no-deploy --name mini-jira-users --region iad --copy-config --now 2>/dev/null || true
$FLY volumes create users_data --app mini-jira-users --region iad --size 1 2>/dev/null || true
$FLY secrets set \
  SECRET_KEY="$SECRET_KEY" \
  --app mini-jira-users
$FLY deploy --app mini-jira-users
echo "✅ Users service deployed!"

# ─── Step 5: Deploy tasks service ──────────────────
echo ""
echo ">>> Deploying tasks service..."
cd "$ROOT/services/tasks"
$FLY launch --no-deploy --name mini-jira-tasks --region iad --copy-config --now 2>/dev/null || true
$FLY volumes create tasks_data --app mini-jira-tasks --region iad --size 1 2>/dev/null || true
$FLY secrets set \
  SECRET_KEY="$SECRET_KEY" \
  REDIS_URL="$REDIS_URL_INPUT" \
  --app mini-jira-tasks
$FLY deploy --app mini-jira-tasks
echo "✅ Tasks service deployed!"

# ─── Step 6: Deploy gateway ─────────────────────────
echo ""
echo ">>> Deploying gateway..."
cd "$ROOT/services/gateway"
$FLY launch --no-deploy --name mini-jira-gateway --region iad --copy-config --now 2>/dev/null || true
$FLY secrets set \
  SECRET_KEY="$SECRET_KEY" \
  USER_SERVICE_URL="http://mini-jira-users.internal:8000" \
  TASK_SERVICE_URL="http://mini-jira-tasks.internal:8000" \
  --app mini-jira-gateway
$FLY deploy --app mini-jira-gateway
echo "✅ Gateway deployed!"

# ─── Step 7: Get gateway URL ────────────────────────
echo ""
echo ">>> Fetching gateway URL..."
GATEWAY_URL=$($FLY status --app mini-jira-gateway --json 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
for h in d.get('Hosts',[]):
    print(h.get('Hostname',''))
" 2>/dev/null || echo "")
if [ -z "$GATEWAY_URL" ]; then
  GATEWAY_URL="$($FLY apps list --json 2>/dev/null | python3 -c "
import sys,json
for a in json.load(sys.stdin):
    if a.get('ID')=='mini-jira-gateway':
        print(a.get('Hostname',''))
" 2>/dev/null || echo "")"
fi
if [ -z "$GATEWAY_URL" ]; then
  GATEWAY_URL="mini-jira-gateway.fly.dev"
fi
echo "   Gateway URL: https://$GATEWAY_URL"

# ─── Step 8: Test gateway ─────────────────────────
echo ""
echo ">>> Testing the gateway..."
sleep 5
curl -sf -X POST "https://$GATEWAY_URL/api/v1/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@minijira.com","password":"admin123"}' && echo "" || echo "⚠️  First request may need a moment (cold start)"

echo ""
echo "============================================"
echo "  ✅ Backend deployed!"
echo "============================================"
echo ""
echo "Gateway: https://$GATEWAY_URL"
echo "Test:    curl https://$GATEWAY_URL/api/v1/auth/signup -X POST ..."
echo ""
echo ""
echo "============================================"
echo "  NEXT: Deploy Frontend to Vercel"
echo "============================================"
echo ""
echo "Method A — Vercel CLI:"
echo "  cd frontend"
echo "  npx vercel --prod"
echo "  # During setup: set VITE_API_URL=https://$GATEWAY_URL"
echo ""
echo "Method B — Vercel.com:"
echo "  1. Push this repo to GitHub"
echo "  2. Go to https://vercel.com/new"
echo "  3. Import your GitHub repo"
echo "  4. Set root directory to 'frontend'"
echo "  5. Add env var: VITE_API_URL = https://$GATEWAY_URL"
echo "  6. Deploy"
echo ""
echo "============================================"
