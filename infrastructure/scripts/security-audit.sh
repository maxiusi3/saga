#!/bin/bash

# Security audit script for Saga application
# This script performs comprehensive security checks and generates a report

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-staging}
DOMAIN=${2:-localhost}
REPORT_FILE="security-audit-$(date +%Y%m%d-%H%M%S).txt"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$REPORT_FILE"
}

print_success() {
    echo -e "${GREEN}[PASS]${NC} $1" | tee -a "$REPORT_FILE"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$REPORT_FILE"
}

print_error() {
    echo -e "${RED}[FAIL]${NC} $1" | tee -a "$REPORT_FILE"
}

# Initialize report
echo "Saga Security Audit Report" > "$REPORT_FILE"
echo "Generated: $(date)" >> "$REPORT_FILE"
echo "Environment: $ENVIRONMENT" >> "$REPORT_FILE"
echo "Domain: $DOMAIN" >> "$REPORT_FILE"
echo "========================================" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

print_status "Starting security audit for Saga application..."

# 1. Check for known vulnerabilities in dependencies
check_dependencies() {
    print_status "Checking for vulnerable dependencies..."
    
    # Check backend dependencies
    if [ -f "packages/backend/package.json" ]; then
        cd packages/backend
        if command -v npm &> /dev/null; then
            if npm audit --audit-level=high --json > /tmp/backend-audit.json 2>/dev/null; then
                vulnerabilities=$(jq '.metadata.vulnerabilities.high + .metadata.vulnerabilities.critical' /tmp/backend-audit.json 2>/dev/null || echo "0")
                if [ "$vulnerabilities" -gt 0 ]; then
                    print_error "Backend has $vulnerabilities high/critical vulnerabilities"
                else
                    print_success "Backend dependencies are secure"
                fi
            else
                print_warning "Could not run npm audit for backend"
            fi
        fi
        cd ../..
    fi
    
    # Check web dependencies
    if [ -f "packages/web/package.json" ]; then
        cd packages/web
        if command -v npm &> /dev/null; then
            if npm audit --audit-level=high --json > /tmp/web-audit.json 2>/dev/null; then
                vulnerabilities=$(jq '.metadata.vulnerabilities.high + .metadata.vulnerabilities.critical' /tmp/web-audit.json 2>/dev/null || echo "0")
                if [ "$vulnerabilities" -gt 0 ]; then
                    print_error "Web app has $vulnerabilities high/critical vulnerabilities"
                else
                    print_success "Web dependencies are secure"
                fi
            else
                print_warning "Could not run npm audit for web"
            fi
        fi
        cd ../..
    fi
    
    # Check mobile dependencies
    if [ -f "packages/mobile/package.json" ]; then
        cd packages/mobile
        if command -v npm &> /dev/null; then
            if npm audit --audit-level=high --json > /tmp/mobile-audit.json 2>/dev/null; then
                vulnerabilities=$(jq '.metadata.vulnerabilities.high + .metadata.vulnerabilities.critical' /tmp/mobile-audit.json 2>/dev/null || echo "0")
                if [ "$vulnerabilities" -gt 0 ]; then
                    print_error "Mobile app has $vulnerabilities high/critical vulnerabilities"
                else
                    print_success "Mobile dependencies are secure"
                fi
            else
                print_warning "Could not run npm audit for mobile"
            fi
        fi
        cd ../..
    fi
}

# 2. Validate SSL/TLS configuration
check_ssl_tls() {
    print_status "Checking SSL/TLS configuration..."
    
    if [ "$DOMAIN" != "localhost" ]; then
        # Check SSL certificate
        if command -v openssl &> /dev/null; then
            if openssl s_client -connect "$DOMAIN:443" -servername "$DOMAIN" </dev/null 2>/dev/null | openssl x509 -noout -dates 2>/dev/null; then
                print_success "SSL certificate is valid"
                
                # Check certificate expiry
                expiry_date=$(openssl s_client -connect "$DOMAIN:443" -servername "$DOMAIN" </dev/null 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
                expiry_timestamp=$(date -d "$expiry_date" +%s 2>/dev/null || echo "0")
                current_timestamp=$(date +%s)
                days_until_expiry=$(( (expiry_timestamp - current_timestamp) / 86400 ))
                
                if [ "$days_until_expiry" -lt 30 ]; then
                    print_warning "SSL certificate expires in $days_until_expiry days"
                else
                    print_success "SSL certificate is valid for $days_until_expiry days"
                fi
            else
                print_error "SSL certificate is invalid or not found"
            fi
            
            # Check TLS version
            if openssl s_client -connect "$DOMAIN:443" -tls1_2 </dev/null 2>/dev/null | grep -q "Protocol.*TLSv1.2"; then
                print_success "TLS 1.2 is supported"
            else
                print_warning "TLS 1.2 support unclear"
            fi
            
            if openssl s_client -connect "$DOMAIN:443" -tls1_3 </dev/null 2>/dev/null | grep -q "Protocol.*TLSv1.3"; then
                print_success "TLS 1.3 is supported"
            else
                print_warning "TLS 1.3 not supported"
            fi
        else
            print_warning "OpenSSL not available for SSL/TLS checks"
        fi
    else
        print_warning "Skipping SSL/TLS checks for localhost"
    fi
}

# 3. Check for exposed secrets
check_exposed_secrets() {
    print_status "Checking for exposed secrets..."
    
    # Common secret patterns
    secret_patterns=(
        "password.*=.*['\"][^'\"]{8,}['\"]"
        "secret.*=.*['\"][^'\"]{16,}['\"]"
        "key.*=.*['\"][^'\"]{16,}['\"]"
        "token.*=.*['\"][^'\"]{16,}['\"]"
        "api[_-]?key.*=.*['\"][^'\"]{16,}['\"]"
        "sk-[a-zA-Z0-9]{32,}"
        "pk_[a-zA-Z0-9]{32,}"
        "AKIA[0-9A-Z]{16}"
        "-----BEGIN.*PRIVATE KEY-----"
    )
    
    found_secrets=0
    
    for pattern in "${secret_patterns[@]}"; do
        if grep -r -i -E "$pattern" packages/ --exclude-dir=node_modules --exclude="*.log" --exclude="*.test.*" 2>/dev/null; then
            found_secrets=$((found_secrets + 1))
        fi
    done
    
    if [ "$found_secrets" -gt 0 ]; then
        print_error "Found $found_secrets potential exposed secrets"
    else
        print_success "No exposed secrets found in code"
    fi
    
    # Check for .env files in git
    if find . -name ".env*" -not -path "./node_modules/*" | grep -v ".env.example" | head -1 >/dev/null; then
        print_warning "Found .env files that might be tracked in git"
    else
        print_success "No .env files found in repository"
    fi
}

# 4. Validate security headers
check_security_headers() {
    print_status "Checking security headers..."
    
    if [ "$DOMAIN" != "localhost" ]; then
        if command -v curl &> /dev/null; then
            headers=$(curl -s -I "https://$DOMAIN" 2>/dev/null || curl -s -I "http://$DOMAIN" 2>/dev/null)
            
            # Check for security headers
            if echo "$headers" | grep -qi "strict-transport-security"; then
                print_success "HSTS header is present"
            else
                print_error "HSTS header is missing"
            fi
            
            if echo "$headers" | grep -qi "content-security-policy"; then
                print_success "CSP header is present"
            else
                print_error "CSP header is missing"
            fi
            
            if echo "$headers" | grep -qi "x-frame-options"; then
                print_success "X-Frame-Options header is present"
            else
                print_error "X-Frame-Options header is missing"
            fi
            
            if echo "$headers" | grep -qi "x-content-type-options"; then
                print_success "X-Content-Type-Options header is present"
            else
                print_error "X-Content-Type-Options header is missing"
            fi
            
            if echo "$headers" | grep -qi "x-xss-protection"; then
                print_success "X-XSS-Protection header is present"
            else
                print_warning "X-XSS-Protection header is missing"
            fi
            
            if echo "$headers" | grep -qi "referrer-policy"; then
                print_success "Referrer-Policy header is present"
            else
                print_warning "Referrer-Policy header is missing"
            fi
            
            # Check for information disclosure
            if echo "$headers" | grep -qi "server:"; then
                server_header=$(echo "$headers" | grep -i "server:" | head -1)
                print_warning "Server header present: $server_header"
            else
                print_success "Server header is hidden"
            fi
            
            if echo "$headers" | grep -qi "x-powered-by"; then
                powered_by=$(echo "$headers" | grep -i "x-powered-by" | head -1)
                print_warning "X-Powered-By header present: $powered_by"
            else
                print_success "X-Powered-By header is hidden"
            fi
        else
            print_warning "curl not available for header checks"
        fi
    else
        print_warning "Skipping security header checks for localhost"
    fi
}

# 5. Check database security settings
check_database_security() {
    print_status "Checking database security configuration..."
    
    # Check if database connection is encrypted
    if [ -f "packages/backend/src/config/database.ts" ]; then
        if grep -q "ssl.*true\|sslmode.*require" packages/backend/src/config/database.ts; then
            print_success "Database SSL is configured"
        else
            print_warning "Database SSL configuration not found"
        fi
    fi
    
    # Check for hardcoded database credentials
    if grep -r -i "password.*=" packages/backend/src/config/ 2>/dev/null | grep -v "process.env" | grep -v "secretsmanager"; then
        print_error "Potential hardcoded database credentials found"
    else
        print_success "No hardcoded database credentials found"
    fi
}

# 6. Check IAM permissions and AWS security
check_aws_security() {
    print_status "Checking AWS security configuration..."
    
    if command -v aws &> /dev/null; then
        # Check if AWS CLI is configured
        if aws sts get-caller-identity &> /dev/null; then
            print_success "AWS CLI is properly configured"
            
            # Check for overly permissive IAM policies
            if aws iam list-attached-role-policies --role-name saga-task-role-${ENVIRONMENT} 2>/dev/null | grep -q "AdministratorAccess"; then
                print_error "Task role has AdministratorAccess policy attached"
            else
                print_success "Task role does not have overly permissive policies"
            fi
            
            # Check S3 bucket public access
            bucket_name="saga-media-${ENVIRONMENT}"
            if aws s3api get-public-access-block --bucket "$bucket_name" 2>/dev/null | grep -q '"BlockPublicAcls": true'; then
                print_success "S3 bucket has public access blocked"
            else
                print_warning "S3 bucket public access configuration unclear"
            fi
            
            # Check RDS encryption
            if aws rds describe-db-instances --query 'DBInstances[?contains(DBInstanceIdentifier, `saga`)].StorageEncrypted' --output text 2>/dev/null | grep -q "True"; then
                print_success "RDS instances are encrypted"
            else
                print_warning "RDS encryption status unclear"
            fi
        else
            print_warning "AWS CLI not configured, skipping AWS security checks"
        fi
    else
        print_warning "AWS CLI not available for security checks"
    fi
}

# 7. Check container security
check_container_security() {
    print_status "Checking container security..."
    
    # Check Dockerfile security practices
    for dockerfile in packages/*/Dockerfile*; do
        if [ -f "$dockerfile" ]; then
            print_status "Checking $dockerfile"
            
            # Check if running as root
            if grep -q "USER root\|^USER 0" "$dockerfile"; then
                print_error "$dockerfile: Container runs as root user"
            elif grep -q "USER " "$dockerfile"; then
                print_success "$dockerfile: Container runs as non-root user"
            else
                print_warning "$dockerfile: No USER directive found"
            fi
            
            # Check for COPY --chown usage
            if grep -q "COPY --chown" "$dockerfile"; then
                print_success "$dockerfile: Uses COPY --chown for proper ownership"
            else
                print_warning "$dockerfile: Consider using COPY --chown"
            fi
            
            # Check for secrets in build args
            if grep -q "ARG.*SECRET\|ARG.*PASSWORD\|ARG.*KEY" "$dockerfile"; then
                print_error "$dockerfile: Potential secrets in build arguments"
            else
                print_success "$dockerfile: No secrets in build arguments"
            fi
        fi
    done
}

# 8. Check network security
check_network_security() {
    print_status "Checking network security configuration..."
    
    # Check CORS configuration
    if [ -f "packages/backend/src/middleware/security-headers.ts" ]; then
        if grep -q "origin.*\*" packages/backend/src/middleware/security-headers.ts; then
            print_error "CORS allows all origins (*)"
        else
            print_success "CORS is properly configured"
        fi
    fi
    
    # Check for HTTP URLs in production code
    if grep -r "http://" packages/ --exclude-dir=node_modules --exclude="*.test.*" --exclude="*.spec.*" | grep -v "localhost" | grep -v "127.0.0.1"; then
        print_warning "Found HTTP URLs in code (should use HTTPS)"
    else
        print_success "No insecure HTTP URLs found"
    fi
}

# 9. Check logging and monitoring security
check_logging_security() {
    print_status "Checking logging and monitoring security..."
    
    # Check for sensitive data in logs
    log_patterns=(
        "password"
        "secret"
        "token"
        "key"
        "credential"
    )
    
    found_sensitive_logs=0
    for pattern in "${log_patterns[@]}"; do
        if grep -r -i "console\.log.*$pattern\|logger.*$pattern" packages/ --exclude-dir=node_modules --exclude="*.test.*" 2>/dev/null; then
            found_sensitive_logs=$((found_sensitive_logs + 1))
        fi
    done
    
    if [ "$found_sensitive_logs" -gt 0 ]; then
        print_error "Found $found_sensitive_logs potential sensitive data in logs"
    else
        print_success "No sensitive data found in logging statements"
    fi
}

# 10. Generate security recommendations
generate_recommendations() {
    print_status "Generating security recommendations..."
    
    echo "" >> "$REPORT_FILE"
    echo "SECURITY RECOMMENDATIONS:" >> "$REPORT_FILE"
    echo "=========================" >> "$REPORT_FILE"
    
    # General recommendations
    cat >> "$REPORT_FILE" << EOF

1. IMMEDIATE ACTIONS:
   - Update all dependencies with known vulnerabilities
   - Ensure all secrets are stored in AWS Secrets Manager
   - Verify SSL/TLS certificates are valid and auto-renewing
   - Enable WAF protection on all public endpoints

2. ONGOING SECURITY PRACTICES:
   - Implement regular security audits (monthly)
   - Set up automated vulnerability scanning in CI/CD
   - Monitor security headers and SSL configuration
   - Review and rotate secrets regularly

3. MONITORING AND ALERTING:
   - Set up alerts for failed authentication attempts
   - Monitor for unusual API usage patterns
   - Implement log analysis for security events
   - Set up SSL certificate expiration alerts

4. COMPLIANCE AND GOVERNANCE:
   - Document security procedures and incident response
   - Implement regular penetration testing
   - Ensure GDPR/privacy compliance for user data
   - Maintain security training for development team

5. INFRASTRUCTURE SECURITY:
   - Regularly review IAM permissions and policies
   - Implement network segmentation and VPC security
   - Enable CloudTrail and GuardDuty for AWS monitoring
   - Use least-privilege access principles

EOF
}

# Main execution
main() {
    print_status "Starting comprehensive security audit..."
    
    check_dependencies
    check_ssl_tls
    check_exposed_secrets
    check_security_headers
    check_database_security
    check_aws_security
    check_container_security
    check_network_security
    check_logging_security
    generate_recommendations
    
    print_status "Security audit completed. Report saved to: $REPORT_FILE"
    
    # Summary
    echo "" >> "$REPORT_FILE"
    echo "AUDIT SUMMARY:" >> "$REPORT_FILE"
    echo "==============" >> "$REPORT_FILE"
    echo "Audit completed at: $(date)" >> "$REPORT_FILE"
    echo "Report file: $REPORT_FILE" >> "$REPORT_FILE"
    
    print_success "Security audit report generated: $REPORT_FILE"
}

# Run the audit
main "$@"