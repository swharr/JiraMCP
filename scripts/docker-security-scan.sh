#!/bin/bash

# Comprehensive Docker security scanning script
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="${1:-jira-mcp-server:latest}"
REPORT_DIR="./security-reports"
TIMESTAMP=$(date +'%Y%m%d_%H%M%S')

# Create reports directory
mkdir -p "${REPORT_DIR}"

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

log "Starting comprehensive security scan for: ${IMAGE_NAME}"

# 1. Trivy vulnerability scan
if command -v trivy &> /dev/null; then
    log "Running Trivy vulnerability scan..."

    # Comprehensive scan with JSON output
    trivy image \
        --format json \
        --output "${REPORT_DIR}/trivy_${TIMESTAMP}.json" \
        "${IMAGE_NAME}"

    # Human-readable table output
    trivy image \
        --format table \
        --severity HIGH,CRITICAL \
        "${IMAGE_NAME}" | tee "${REPORT_DIR}/trivy_${TIMESTAMP}.txt"

    # Check for critical vulnerabilities
    CRITICAL_COUNT=$(trivy image --format json "${IMAGE_NAME}" | jq '[.Results[]?.Vulnerabilities[]? | select(.Severity == "CRITICAL")] | length' 2>/dev/null || echo "0")
    HIGH_COUNT=$(trivy image --format json "${IMAGE_NAME}" | jq '[.Results[]?.Vulnerabilities[]? | select(.Severity == "HIGH")] | length' 2>/dev/null || echo "0")

    info "Found ${CRITICAL_COUNT} CRITICAL and ${HIGH_COUNT} HIGH severity vulnerabilities"

    if [ "${CRITICAL_COUNT}" -gt 0 ]; then
        error "Critical vulnerabilities found! Review the report."
    fi
else
    warn "Trivy not found. Install with: brew install trivy"
fi

# 2. Docker Scout (if available)
if command -v docker &> /dev/null && docker scout version &> /dev/null; then
    log "Running Docker Scout scan..."
    docker scout cves "${IMAGE_NAME}" --format json --output "${REPORT_DIR}/docker_scout_${TIMESTAMP}.json" 2>/dev/null || warn "Docker Scout scan failed"
    docker scout cves "${IMAGE_NAME}" --format table | tee "${REPORT_DIR}/docker_scout_${TIMESTAMP}.txt" 2>/dev/null || warn "Docker Scout table output failed"
else
    warn "Docker Scout not available. Enable with: docker scout"
fi

# 3. Container structure test (if available)
if command -v container-structure-test &> /dev/null; then
    log "Running container structure test..."
    # Create basic structure test config if it doesn't exist
    if [ ! -f "container-structure-test.yaml" ]; then
        cat > container-structure-test.yaml << EOF
schemaVersion: '2.0.0'
fileExistenceTests:
  - name: 'application files'
    path: '/app/dist/index.js'
    shouldExist: true
  - name: 'package.json'
    path: '/app/package.json'
    shouldExist: true
fileContentTests:
  - name: 'non-root user'
    path: '/etc/passwd'
    expectedContents: ['nodejs:x:1001:1001']
commandTests:
  - name: 'node version'
    command: 'node'
    args: ['--version']
    expectedOutput: ['v20.*']
  - name: 'health check endpoint'
    command: 'curl'
    args: ['-f', 'http://localhost:8080/health']
    setup: [['node', 'dist/index.js', '&'], ['sleep', '5']]
    teardown: [['pkill', '-f', 'node']]
EOF
    fi

    container-structure-test test \
        --image "${IMAGE_NAME}" \
        --config container-structure-test.yaml \
        --output "${REPORT_DIR}/structure_test_${TIMESTAMP}.json" || warn "Structure test failed"
else
    warn "container-structure-test not found. Install from: https://github.com/GoogleContainerTools/container-structure-test"
fi

# 4. Dockerfile security analysis with hadolint (if available)
if command -v hadolint &> /dev/null; then
    log "Running Dockerfile security analysis with hadolint..."
    hadolint Dockerfile --format json > "${REPORT_DIR}/hadolint_${TIMESTAMP}.json" 2>/dev/null || warn "Hadolint analysis failed"
    hadolint Dockerfile | tee "${REPORT_DIR}/hadolint_${TIMESTAMP}.txt" 2>/dev/null || warn "Hadolint text output failed"
else
    warn "hadolint not found. Install with: brew install hadolint"
fi

# 5. Image layer analysis
log "Analyzing image layers..."
docker history "${IMAGE_NAME}" --human --format "table {{.CreatedBy}}\t{{.Size}}" > "${REPORT_DIR}/image_layers_${TIMESTAMP}.txt"

# 6. Generate security summary
log "Generating security summary..."
cat > "${REPORT_DIR}/security_summary_${TIMESTAMP}.md" << EOF
# Security Scan Summary

**Image:** ${IMAGE_NAME}
**Scan Date:** $(date)
**Reports Directory:** ${REPORT_DIR}

## Vulnerabilities
- **Critical:** ${CRITICAL_COUNT:-"N/A"}
- **High:** ${HIGH_COUNT:-"N/A"}

## Scan Tools Used
- $(command -v trivy &> /dev/null && echo "✅ Trivy" || echo "❌ Trivy")
- $(command -v docker &> /dev/null && docker scout version &> /dev/null 2>&1 && echo "✅ Docker Scout" || echo "❌ Docker Scout")
- $(command -v container-structure-test &> /dev/null && echo "✅ Container Structure Test" || echo "❌ Container Structure Test")
- $(command -v hadolint &> /dev/null && echo "✅ Hadolint" || echo "❌ Hadolint")

## Reports Generated
- \`trivy_${TIMESTAMP}.json\` - Detailed vulnerability report
- \`trivy_${TIMESTAMP}.txt\` - Human-readable vulnerability summary
- \`docker_scout_${TIMESTAMP}.json\` - Docker Scout analysis (if available)
- \`hadolint_${TIMESTAMP}.json\` - Dockerfile security analysis
- \`image_layers_${TIMESTAMP}.txt\` - Image layer breakdown

## Recommendations
1. Review all CRITICAL and HIGH severity vulnerabilities
2. Update base image if vulnerabilities are found in the OS layer
3. Update Node.js dependencies if application vulnerabilities are found
4. Consider using distroless images for production
5. Implement regular automated scanning in CI/CD pipeline

## Next Steps
- Address any critical vulnerabilities immediately
- Set up automated scanning in CI/CD
- Configure vulnerability alerting
- Review and update security policies
EOF

log "Security scan complete!"
info "Reports saved to: ${REPORT_DIR}/"
info "Summary: ${REPORT_DIR}/security_summary_${TIMESTAMP}.md"

# Open summary if on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    open "${REPORT_DIR}/security_summary_${TIMESTAMP}.md"
fi

# Return appropriate exit code based on critical vulnerabilities
if [ "${CRITICAL_COUNT:-0}" -gt 0 ]; then
    error "Security scan failed due to critical vulnerabilities!"
    exit 1
else
    log "Security scan completed successfully!"
    exit 0
fi