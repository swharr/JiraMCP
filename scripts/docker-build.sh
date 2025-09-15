#!/bin/bash

# Docker build and security scanning script
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="jira-mcp-server"
VERSION=${1:-"latest"}
REGISTRY=${DOCKER_REGISTRY:-""}
DOCKERFILE=${DOCKERFILE:-"Dockerfile"}
PLATFORM=${PLATFORM:-"linux/amd64,linux/arm64"}

echo -e "${GREEN}Building Jira MCP Server Docker image...${NC}"

# Function to log messages
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    error "Docker is not running. Please start Docker and try again."
fi

# Build the image
log "Building Docker image: ${IMAGE_NAME}:${VERSION}"
docker build \
    --file "${DOCKERFILE}" \
    --tag "${IMAGE_NAME}:${VERSION}" \
    --tag "${IMAGE_NAME}:latest" \
    --platform "${PLATFORM}" \
    --build-arg BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
    --build-arg VCS_REF="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')" \
    --build-arg VERSION="${VERSION}" \
    .

if [ $? -eq 0 ]; then
    log "Docker image built successfully!"
else
    error "Docker build failed!"
fi

# Security scanning with Trivy (if available)
if command -v trivy &> /dev/null; then
    log "Running Trivy security scan..."
    trivy image \
        --exit-code 1 \
        --severity HIGH,CRITICAL \
        --format table \
        "${IMAGE_NAME}:${VERSION}"

    if [ $? -eq 0 ]; then
        log "Security scan passed!"
    else
        warn "Security scan found vulnerabilities. Review the output above."
    fi
else
    warn "Trivy not found. Skipping security scan. Install with: brew install trivy"
fi

# Test the image
log "Testing the built image..."
docker run --rm \
    --health-timeout=10s \
    --health-retries=3 \
    "${IMAGE_NAME}:${VERSION}" \
    node --version

# Show image details
log "Image details:"
docker images "${IMAGE_NAME}:${VERSION}"

# Tag for registry if specified
if [ -n "${REGISTRY}" ]; then
    FULL_IMAGE="${REGISTRY}/${IMAGE_NAME}:${VERSION}"
    log "Tagging for registry: ${FULL_IMAGE}"
    docker tag "${IMAGE_NAME}:${VERSION}" "${FULL_IMAGE}"

    read -p "Push to registry? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log "Pushing to registry..."
        docker push "${FULL_IMAGE}"
        log "Image pushed successfully!"
    fi
fi

log "Build complete! Image: ${IMAGE_NAME}:${VERSION}"