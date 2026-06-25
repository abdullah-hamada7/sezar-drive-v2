#!/usr/bin/env bash
set -euo pipefail

# ─── Sezar Drive — Build & Push Docker Images ─────────────────────────────
# Usage:
#   ./scripts/build-and-push.sh              # build + push (prompts for tag)
#   ./scripts/build-and-push.sh <tag>        # build + push with explicit tag
#   DOCKER_USERNAME=me ./scripts/build-and-push.sh  # override username
#
# Prerequisites: docker logged in to Docker Hub
# ────────────────────────────────────────────────────────────────────────────

DOCKER_USERNAME="${DOCKER_USERNAME:-abdullahhamada7}"
TAG="${1:-latest}"

BACKEND_IMAGE="${DOCKER_USERNAME}/sezar-drive-backend:${TAG}"
FRONTEND_IMAGE="${DOCKER_USERNAME}/sezar-drive-frontend:${TAG}"

echo "============================================================"
echo " Sezar Drive — Building & Pushing Docker Images"
echo " Tag:        ${TAG}"
echo " Backend:    ${BACKEND_IMAGE}"
echo " Frontend:   ${FRONTEND_IMAGE}"
echo "============================================================"
echo ""

# ── Build backend ────────────────────────────────────────────────────────
echo ">>> Building backend..."
docker build \
  -f backend/Dockerfile \
  -t "${BACKEND_IMAGE}" \
  .

# ── Build frontend ───────────────────────────────────────────────────────
echo ">>> Building frontend..."
docker build \
  -f frontend/Dockerfile \
  -t "${FRONTEND_IMAGE}" \
  .

# ── Push ─────────────────────────────────────────────────────────────────
echo ">>> Pushing backend..."
docker push "${BACKEND_IMAGE}"

echo ">>> Pushing frontend..."
docker push "${FRONTEND_IMAGE}"

echo ""
echo "============================================================"
echo " Done! Pushed:"
echo "   ${BACKEND_IMAGE}"
echo "   ${FRONTEND_IMAGE}"
echo "============================================================"
