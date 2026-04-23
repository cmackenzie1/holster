#!/bin/bash
set -euo pipefail

WORKERS=(
  codec
  dns
  echo
  gradient
  hash
  hello-world
  ip
  jwt
  parking
  rand
  rdap
  stocks
)

for worker in "${WORKERS[@]}"; do
  echo "==> Deploying $worker"
  bun run --filter "$worker" deploy
  echo ""
done

echo "==> All workers deployed successfully"
