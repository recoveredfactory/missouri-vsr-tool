#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

# Load .env if present
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

PATHS="${1:-/*}"

# Resolve distribution ID
DIST_ID="${DATA_CDN_DISTRIBUTION_ID:-}"

if [[ -z "$DIST_ID" ]]; then
  # Try SST outputs first
  OUTPUTS="$ROOT_DIR/.sst/outputs.json"
  if [[ -f "$OUTPUTS" ]]; then
    DIST_ID=$(python3 -c "
import json, sys
data = json.load(open('$OUTPUTS'))
for v in data.values():
  if isinstance(v, dict) and v.get('dataCdnDistributionId'):
    print(v['dataCdnDistributionId'])
    break
" 2>/dev/null || true)
  fi
fi

if [[ -z "$DIST_ID" ]]; then
  # Fall back: look up by domain alias in CloudFront
  DOMAIN="${DATA_CDN_DOMAIN:-${PUBLIC_DATA_BASE_URL:-}}"
  DOMAIN="${DOMAIN#https://}"  # strip scheme if present
  if [[ -n "$DOMAIN" ]]; then
    echo "Looking up CloudFront distribution for domain: $DOMAIN"
    DIST_ID=$(aws cloudfront list-distributions --output json 2>/dev/null | python3 -c "
import json, sys
domain = '$DOMAIN'
data = json.load(sys.stdin)
for dist in data.get('DistributionList', {}).get('Items', []):
    aliases = dist.get('Aliases', {}).get('Items', [])
    if domain in aliases or domain == dist.get('DomainName', ''):
        print(dist['Id'])
        break
" 2>/dev/null || true)
  fi
fi

if [[ -z "$DIST_ID" ]]; then
  echo "Could not find CloudFront distribution ID." >&2
  echo "Set DATA_CDN_DISTRIBUTION_ID in .env or deploy with SST first." >&2
  exit 1
fi

echo "Invalidating CloudFront distribution $DIST_ID — paths: $PATHS"
aws cloudfront create-invalidation \
  --distribution-id "$DIST_ID" \
  --paths "$PATHS" \
  --output table
