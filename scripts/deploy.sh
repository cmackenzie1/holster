#!/bin/bash
set -euo pipefail

WORKERS=(
  echo
  gradient
  hash
  hello-world
  ip
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
