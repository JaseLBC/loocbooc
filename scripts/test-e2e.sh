#!/bin/bash
# ================================================================
# Loocbooc End-to-End Test
# Proves the full stack is working: API, DB, Redis, MinIO, Pipeline
#
# Usage:
#   ./scripts/test-e2e.sh [BASE_URL]
#   ./scripts/test-e2e.sh http://localhost:8000
# ================================================================

set -e

BASE_URL="${1:-http://localhost:8000}"
API_KEY="lb_live_testkey_charcoal"
PASS=0
FAIL=0

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ok()   { echo -e "  ${GREEN}✓${NC} $1"; PASS=$((PASS+1)); }
fail() { echo -e "  ${RED}✗${NC} $1"; FAIL=$((FAIL+1)); }
info() { echo -e "  ${YELLOW}→${NC} $1"; }

echo ""
echo "================================================================"
echo "  Loocbooc E2E Test"
echo "  Base URL: $BASE_URL"
echo "================================================================"
echo ""

# Check dependencies
for cmd in curl jq; do
    if ! command -v $cmd &> /dev/null; then
        echo "ERROR: '$cmd' is required but not installed."
        exit 1
    fi
done

# ── 1. Root endpoint ──────────────────────────────────────────
echo "1. Root endpoint..."
ROOT=$(curl -sf "$BASE_URL/" 2>&1) && ok "Root responds" || fail "Root unreachable"
info "$(echo "$ROOT" | jq -r '.service // "no service field"' 2>/dev/null || echo "$ROOT")"

# ── 2. Health check ───────────────────────────────────────────
echo ""
echo "2. Health check..."
HEALTH=$(curl -sf "$BASE_URL/health" 2>&1)
if [ $? -eq 0 ]; then
    STATUS=$(echo "$HEALTH" | jq -r '.status' 2>/dev/null || echo "unknown")
    DB=$(echo "$HEALTH" | jq -r '.database' 2>/dev/null || echo "unknown")
    REDIS=$(echo "$HEALTH" | jq -r '.redis' 2>/dev/null || echo "unknown")
    ok "Health endpoint responds"
    info "status=$STATUS  database=$DB  redis=$REDIS"
    [ "$STATUS" = "ok" ] && ok "Status is 'ok'" || fail "Status is '$STATUS' (expected 'ok')"
    [ "$DB" = "ok" ] && ok "Database connected" || fail "Database status: $DB"
    [ "$REDIS" = "ok" ] && ok "Redis connected" || fail "Redis status: $REDIS"
else
    fail "Health endpoint unreachable"
fi

# ── 3. OpenAPI docs ───────────────────────────────────────────
echo ""
echo "3. OpenAPI docs..."
DOCS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/docs")
[ "$DOCS_STATUS" = "200" ] && ok "Docs available at $BASE_URL/docs" || fail "Docs returned $DOCS_STATUS"

OPENAPI_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/openapi.json")
[ "$OPENAPI_STATUS" = "200" ] && ok "OpenAPI JSON available" || fail "OpenAPI JSON returned $OPENAPI_STATUS"

# ── 4. Create a garment ───────────────────────────────────────
echo ""
echo "4. Creating test garment..."
GARMENT=$(curl -sf -X POST "$BASE_URL/api/v1/garments" \
    -H "X-API-Key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"name":"E2E Test Dress","category":"dresses","description":"End-to-end test garment"}' 2>&1)

if [ $? -eq 0 ]; then
    UGI=$(echo "$GARMENT" | jq -r '.id // .ugi' 2>/dev/null || echo "")
    if [ -n "$UGI" ] && [ "$UGI" != "null" ]; then
        ok "Garment created"
        ok "UGI: $UGI"
        info "$(echo "$GARMENT" | jq '{ugi: .id, name: .name, status: .status}' 2>/dev/null || echo "$GARMENT")"
    else
        fail "Garment created but no UGI in response"
        info "Response: $(echo "$GARMENT" | head -c 300)"
    fi
else
    fail "Garment creation failed: $GARMENT"
    UGI=""
fi

# ── 5. Upload a test photo ────────────────────────────────────
if [ -n "$UGI" ]; then
    echo ""
    echo "5. Uploading test photo to $UGI..."

    # Create a minimal 1x1 JPEG (base64 encoded) for testing
    TEMP_JPG=$(mktemp /tmp/test_photo_XXXXXX.jpg)

    # Minimal valid JPEG bytes (1x1 pixel, white)
    printf '\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.\' ",#\x1c\x1c(7),01444\x1f'"'"'9=82<.342\x1b\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xf5\x0a\xff\xd9' > "$TEMP_JPG" 2>/dev/null || true

    # Fallback: use a simple PNG if JPEG creation fails
    if [ ! -s "$TEMP_JPG" ]; then
        # 1x1 white pixel PNG (minimal valid PNG)
        printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82' > "${TEMP_JPG%.jpg}.png" 2>/dev/null || true
        TEMP_JPG="${TEMP_JPG%.jpg}.png"
    fi

    UPLOAD_RESP=$(curl -sf -X POST "$BASE_URL/api/v1/garments/$UGI/files" \
        -H "X-API-Key: $API_KEY" \
        -F "file=@$TEMP_JPG" 2>&1)

    rm -f "$TEMP_JPG" 2>/dev/null || true

    if [ $? -eq 0 ]; then
        ok "Photo uploaded successfully"
        info "$(echo "$UPLOAD_RESP" | jq '{file_type, size_bytes, pipeline_triggered}' 2>/dev/null || echo "$UPLOAD_RESP" | head -c 200)"
    else
        fail "Photo upload failed: $(echo "$UPLOAD_RESP" | head -c 300)"
    fi

    # ── 6. Get garment status ─────────────────────────────────
    echo ""
    echo "6. Checking garment status..."
    GARMENT_STATUS=$(curl -sf "$BASE_URL/api/v1/garments/$UGI" \
        -H "X-API-Key: $API_KEY" 2>&1)

    if [ $? -eq 0 ]; then
        ok "Garment retrievable"
        info "$(echo "$GARMENT_STATUS" | jq '{ugi: .id, name: .name, status: .status, has_model_3d: .has_model_3d}' 2>/dev/null || echo "$GARMENT_STATUS" | head -c 200)"
    else
        fail "Garment retrieval failed"
    fi
fi

# ── 7. MinIO object storage ───────────────────────────────────
echo ""
echo "7. MinIO storage..."
MINIO_HEALTH=$(curl -sf "http://localhost:9000/minio/health/live" 2>&1)
[ $? -eq 0 ] && ok "MinIO API reachable at localhost:9000" || fail "MinIO not reachable at localhost:9000"

MINIO_CONSOLE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:9001" 2>/dev/null)
[ "$MINIO_CONSOLE" = "200" ] || [ "$MINIO_CONSOLE" = "303" ] || [ "$MINIO_CONSOLE" = "301" ] \
    && ok "MinIO Console reachable at localhost:9001" \
    || info "MinIO Console: HTTP $MINIO_CONSOLE (may redirect)"

# ── Summary ───────────────────────────────────────────────────
echo ""
echo "================================================================"
TOTAL=$((PASS+FAIL))
if [ $FAIL -eq 0 ]; then
    echo -e "  ${GREEN}✓ All $TOTAL checks passed${NC}"
    echo ""
    echo "  Test credentials:"
    echo "    API Key: $API_KEY"
    echo "    Docs:    $BASE_URL/docs"
    echo "    MinIO:   http://localhost:9001  (user: minioadmin / pass: minioadmin)"
    if [ -n "$UGI" ]; then
        echo "    UGI:     $UGI"
    fi
else
    echo -e "  ${RED}✗ $FAIL/$TOTAL checks failed${NC} (${GREEN}$PASS passed${NC})"
fi
echo "================================================================"
echo ""

[ $FAIL -eq 0 ] && exit 0 || exit 1
