#!/usr/bin/env bash

set -euo pipefail

if [[ -z "${BETTERSTACK_TOKEN:-}" ]]; then
  echo "BETTERSTACK_TOKEN is not set. Export the token and retry." >&2
  exit 1
fi

if [[ -z "${PAGERDUTY_POLICY_ID:-}" ]]; then
  echo "PAGERDUTY_POLICY_ID is not set. Monitors will be created without escalation. Set it if you want automatic paging." >&2
fi

create_monitor() {
  local url=$1
  local label=$2

  echo "Creating monitor for ${label} (${url})"

  local policy_block=""
  if [[ -n "${PAGERDUTY_POLICY_ID:-}" ]]; then
    policy_block="\"policy_id\": \"${PAGERDUTY_POLICY_ID}\","
  fi

  curl -sS -X POST "https://betteruptime.com/api/v2/monitors" \
    -H "Authorization: Bearer ${BETTERSTACK_TOKEN}" \
    -H "Content-Type: application/json" \
    -d @- <<JSON
{
  "monitor_type": "status",
  "url": "${url}",
  "call": false,
  "sms": false,
  "email": true,
  "push": true,
  ${policy_block}
  "request_timeout": 10,
  "http_method": "get"
}
JSON
  echo
}

create_monitor "https://iwishbag.store" "iwishbag-storefront"
create_monitor "https://merchant.iwishbag.store" "iwishbag-merchant"
create_monitor "https://api.iwishbag.store/health" "iwishbag-api-health"

echo "Done. Verify monitors in the Better Uptime dashboard."
