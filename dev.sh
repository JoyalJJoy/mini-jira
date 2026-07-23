#!/usr/bin/env zsh
# Start all microservices + frontend for local development

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "=== Starting backend services ==="

source "$ROOT/.venv/bin/activate"

# Clean old DBs for a fresh state
find "$ROOT/services" -name "*.db" -delete 2>/dev/null

# Start user service
cd "$ROOT/services/users"
uvicorn app.main:app --host 0.0.0.0 --port 8001 --log-level warning &
echo "  [users]   http://localhost:8001"

# Start task service  
cd "$ROOT/services/tasks"
uvicorn app.main:app --host 0.0.0.0 --port 8002 --log-level warning &
echo "  [tasks]   http://localhost:8002"

# Start gateway
cd "$ROOT/services/gateway"
uvicorn app.main:app --host 0.0.0.0 --port 8000 --log-level warning &
echo "  [gateway] http://localhost:8000"

# Wait for services to be ready
sleep 3

echo ""
echo "=== Starting frontend ==="
cd "$ROOT/frontend"
npm run dev &
echo "  [frontend] http://localhost:5173"

echo ""
echo "========================================"
echo "  Open http://localhost:5173 in browser"
echo "  Press Ctrl+C to stop all services"
echo "========================================"

# Trap Ctrl+C to kill all background jobs
trap 'echo ""; echo "Stopping all..."; kill $(jobs -p) 2>/dev/null; wait 2>/dev/null; exit 0' INT

# Wait for any background job to exit
wait
