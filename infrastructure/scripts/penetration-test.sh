#!/bin/bash

# Penetration testing script for Saga application
# This script performs basic security testing and vulnerability assessment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-staging}
TARGET_URL=${2:-http://localhost:3001}
REPORT_FILE="pentest-report-$(date +%Y%m%d-%H%M%S).txt"

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
    echo -e "${RED}[VULN]${NC} $1" | tee -a "$REPORT_FILE"
}

# Initialize report
echo "Saga Penetration Testing Report" > "$REPORT_FILE"
echo "Generated: $(date)" >> "$REPORT_FILE"
echo "Environment: $ENVIRONMENT" >> "$REPORT_FILE"
echo "Target URL: $TARGET_URL" >> "$REPORT_FILE"
echo "========================================" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

print_status "Starting penetration testing for Saga application..."

# 1. Information gathering
information_gathering() {
    print_status "Phase 1: Information Gathering"
    
    # Check if target is reachable
    if curl -s --connect-timeout 5 "$TARGET_URL/health" > /dev/null; then
        print_success "Target is reachable"
    else
        print_error "Target is not reachable"
        return 1
    fi
    
    # Gather server information
    server_info=$(curl -s -I "$TARGET_URL" | grep -i "server\|x-powered-by\|x-aspnet-version" || echo "No server info disclosed")
    echo "Server Information: $server_info" >> "$REPORT_FILE"
    
    # Check for common files
    common_files=(
        "robots.txt"
        "sitemap.xml"
        ".well-known/security.txt"
        "package.json"
        ".env"
        "config.json"
        "swagger.json"
        "api-docs"
    )
    
    for file in "${common_files[@]}"; do
        if curl -s -o /dev/null -w "%{http_code}" "$TARGET_URL/$file" | grep -q "200"; then
            print_warning "Found accessible file: $file"
        fi
    done
}

# 2. Authentication testing
authentication_testing() {
    print_status "Phase 2: Authentication Testing"
    
    # Test for default credentials
    default_creds=(
        "admin:admin"
        "admin:password"
        "root:root"
        "test:test"
    )
    
    for cred in "${default_creds[@]}"; do
        username=$(echo "$cred" | cut -d: -f1)
        password=$(echo "$cred" | cut -d: -f2)
        
        response=$(curl -s -X POST "$TARGET_URL/api/auth/signin" \
            -H "Content-Type: application/json" \
            -d "{\"email\":\"$username@example.com\",\"password\":\"$password\"}" \
            -w "%{http_code}")
        
        if echo "$response" | grep -q "200"; then
            print_error "Default credentials work: $username:$password"
        fi
    done
    
    # Test password reset functionality
    print_status "Testing password reset functionality..."
    
    # Test for user enumeration via password reset
    test_emails=(
        "admin@example.com"
        "test@example.com"
        "nonexistent@example.com"
    )
    
    for email in "${test_emails[@]}"; do
        response=$(curl -s -X POST "$TARGET_URL/api/auth/reset-password" \
            -H "Content-Type: application/json" \
            -d "{\"email\":\"$email\"}" \
            -w "%{http_code}")
        
        # Check if response differs for existing vs non-existing users
        echo "Password reset response for $email: $response" >> "$REPORT_FILE"
    done
    
    # Test for brute force protection
    print_status "Testing brute force protection..."
    
    for i in {1..10}; do
        curl -s -X POST "$TARGET_URL/api/auth/signin" \
            -H "Content-Type: application/json" \
            -d '{"email":"test@example.com","password":"wrongpassword"}' \
            > /dev/null
    done
    
    # Check if subsequent request is blocked
    response=$(curl -s -X POST "$TARGET_URL/api/auth/signin" \
        -H "Content-Type: application/json" \
        -d '{"email":"test@example.com","password":"wrongpassword"}' \
        -w "%{http_code}")
    
    if echo "$response" | grep -q "429"; then
        print_success "Brute force protection is active"
    else
        print_error "No brute force protection detected"
    fi
}

# 3. Input validation testing
input_validation_testing() {
    print_status "Phase 3: Input Validation Testing"
    
    # SQL Injection payloads
    sql_payloads=(
        "' OR '1'='1"
        "'; DROP TABLE users; --"
        "' UNION SELECT * FROM users --"
        "admin'--"
        "admin' #"
        "admin'/*"
    )
    
    for payload in "${sql_payloads[@]}"; do
        response=$(curl -s -X POST "$TARGET_URL/api/auth/signin" \
            -H "Content-Type: application/json" \
            -d "{\"email\":\"$payload\",\"password\":\"test\"}" \
            -w "%{http_code}")
        
        if echo "$response" | grep -q "500"; then
            print_error "Potential SQL injection vulnerability with payload: $payload"
        fi
    done
    
    # XSS payloads
    xss_payloads=(
        "<script>alert('XSS')</script>"
        "javascript:alert('XSS')"
        "<img src=x onerror=alert('XSS')>"
        "';alert('XSS');//"
    )
    
    # Test XSS in various endpoints
    endpoints=(
        "/api/projects"
        "/api/stories"
        "/api/users"
    )
    
    for endpoint in "${endpoints[@]}"; do
        for payload in "${xss_payloads[@]}"; do
            response=$(curl -s -X POST "$TARGET_URL$endpoint" \
                -H "Content-Type: application/json" \
                -d "{\"name\":\"$payload\",\"description\":\"test\"}" \
                -w "%{http_code}")
            
            # Check if payload is reflected in response
            if echo "$response" | grep -q "$payload"; then
                print_error "Potential XSS vulnerability in $endpoint with payload: $payload"
            fi
        done
    done
    
    # Command injection testing
    cmd_payloads=(
        "; ls -la"
        "| whoami"
        "&& cat /etc/passwd"
        "; cat /etc/passwd"
        "| cat /etc/passwd"
    )
    
    for payload in "${cmd_payloads[@]}"; do
        response=$(curl -s -X POST "$TARGET_URL/api/uploads" \
            -H "Content-Type: application/json" \
            -d "{\"filename\":\"test$payload.txt\"}" \
            -w "%{http_code}")
        
        if echo "$response" | grep -q "root:\|bin:\|daemon:"; then
            print_error "Potential command injection vulnerability with payload: $payload"
        fi
    done
}

# 4. Authorization testing
authorization_testing() {
    print_status "Phase 4: Authorization Testing"
    
    # Test for insecure direct object references
    test_ids=(1 2 3 100 999 -1 0)
    
    endpoints=(
        "/api/projects"
        "/api/stories"
        "/api/users"
    )
    
    for endpoint in "${endpoints[@]}"; do
        for id in "${test_ids[@]}"; do
            response=$(curl -s -X GET "$TARGET_URL$endpoint/$id" -w "%{http_code}")
            
            if echo "$response" | grep -q "200"; then
                print_warning "Accessible resource without authentication: $endpoint/$id"
            fi
        done
    done
    
    # Test for privilege escalation
    print_status "Testing for privilege escalation..."
    
    # Try to access admin endpoints without proper authorization
    admin_endpoints=(
        "/api/admin/users"
        "/api/admin/monitoring"
        "/api/admin/logs"
        "/api/monitoring"
    )
    
    for endpoint in "${admin_endpoints[@]}"; do
        response=$(curl -s -X GET "$TARGET_URL$endpoint" -w "%{http_code}")
        
        if echo "$response" | grep -q "200"; then
            print_error "Admin endpoint accessible without authentication: $endpoint"
        fi
    done
}

# 5. Session management testing
session_testing() {
    print_status "Phase 5: Session Management Testing"
    
    # Test for session fixation
    print_status "Testing session management..."
    
    # Get initial session
    session1=$(curl -s -c /tmp/cookies1.txt "$TARGET_URL/api/auth/signin" -X POST \
        -H "Content-Type: application/json" \
        -d '{"email":"test@example.com","password":"testpassword"}' | grep -o '"token":"[^"]*"' || echo "")
    
    # Test if session persists after logout
    if [ -n "$session1" ]; then
        curl -s -b /tmp/cookies1.txt "$TARGET_URL/api/auth/signout" -X POST > /dev/null
        
        response=$(curl -s -b /tmp/cookies1.txt "$TARGET_URL/api/auth/profile" -w "%{http_code}")
        
        if echo "$response" | grep -q "200"; then
            print_error "Session not properly invalidated after logout"
        else
            print_success "Session properly invalidated after logout"
        fi
    fi
    
    # Clean up
    rm -f /tmp/cookies1.txt
}

# 6. File upload testing
file_upload_testing() {
    print_status "Phase 6: File Upload Testing"
    
    # Test malicious file uploads
    malicious_files=(
        "test.php"
        "test.jsp"
        "test.asp"
        "test.exe"
        "test.sh"
    )
    
    for file in "${malicious_files[@]}"; do
        # Create temporary malicious file
        echo "<?php system(\$_GET['cmd']); ?>" > "/tmp/$file"
        
        response=$(curl -s -X POST "$TARGET_URL/api/uploads" \
            -F "file=@/tmp/$file" \
            -w "%{http_code}")
        
        if echo "$response" | grep -q "200"; then
            print_error "Malicious file upload accepted: $file"
        else
            print_success "Malicious file upload rejected: $file"
        fi
        
        # Clean up
        rm -f "/tmp/$file"
    done
    
    # Test oversized file upload
    print_status "Testing file size limits..."
    
    # Create large file (100MB)
    dd if=/dev/zero of=/tmp/largefile.txt bs=1M count=100 2>/dev/null
    
    response=$(curl -s -X POST "$TARGET_URL/api/uploads" \
        -F "file=@/tmp/largefile.txt" \
        -w "%{http_code}")
    
    if echo "$response" | grep -q "413\|400"; then
        print_success "File size limits are enforced"
    else
        print_warning "File size limits may not be properly enforced"
    fi
    
    # Clean up
    rm -f /tmp/largefile.txt
}

# 7. API security testing
api_security_testing() {
    print_status "Phase 7: API Security Testing"
    
    # Test for API versioning issues
    api_versions=("v1" "v2" "v3" "beta" "alpha" "test")
    
    for version in "${api_versions[@]}"; do
        response=$(curl -s -X GET "$TARGET_URL/api/$version/users" -w "%{http_code}")
        
        if echo "$response" | grep -q "200"; then
            print_warning "API version accessible: $version"
        fi
    done
    
    # Test HTTP methods
    methods=("GET" "POST" "PUT" "DELETE" "PATCH" "HEAD" "OPTIONS" "TRACE")
    
    for method in "${methods[@]}"; do
        response=$(curl -s -X "$method" "$TARGET_URL/api/users" -w "%{http_code}")
        
        if [ "$method" = "TRACE" ] && echo "$response" | grep -q "200"; then
            print_error "HTTP TRACE method is enabled (potential XST vulnerability)"
        fi
        
        if [ "$method" = "OPTIONS" ] && echo "$response" | grep -q "200"; then
            print_status "OPTIONS method response logged for analysis"
        fi
    done
    
    # Test for GraphQL introspection (if applicable)
    graphql_response=$(curl -s -X POST "$TARGET_URL/graphql" \
        -H "Content-Type: application/json" \
        -d '{"query":"query IntrospectionQuery { __schema { queryType { name } } }"}' \
        -w "%{http_code}")
    
    if echo "$graphql_response" | grep -q "queryType"; then
        print_warning "GraphQL introspection is enabled"
    fi
}

# 8. SSL/TLS testing
ssl_testing() {
    print_status "Phase 8: SSL/TLS Testing"
    
    if [[ "$TARGET_URL" == https://* ]]; then
        domain=$(echo "$TARGET_URL" | sed 's|https://||' | sed 's|/.*||')
        
        # Test SSL configuration
        if command -v openssl &> /dev/null; then
            # Test for weak ciphers
            weak_ciphers=("RC4" "DES" "3DES" "MD5")
            
            for cipher in "${weak_ciphers[@]}"; do
                if openssl s_client -connect "$domain:443" -cipher "$cipher" </dev/null 2>/dev/null | grep -q "Cipher is"; then
                    print_error "Weak cipher supported: $cipher"
                fi
            done
            
            # Test for SSL/TLS versions
            ssl_versions=("-ssl2" "-ssl3" "-tls1" "-tls1_1")
            
            for version in "${ssl_versions[@]}"; do
                if openssl s_client -connect "$domain:443" "$version" </dev/null 2>/dev/null | grep -q "Protocol"; then
                    print_error "Insecure SSL/TLS version supported: $version"
                fi
            done
        fi
    else
        print_warning "Target is not using HTTPS, skipping SSL/TLS tests"
    fi
}

# 9. Generate recommendations
generate_recommendations() {
    print_status "Generating security recommendations..."
    
    echo "" >> "$REPORT_FILE"
    echo "SECURITY RECOMMENDATIONS:" >> "$REPORT_FILE"
    echo "=========================" >> "$REPORT_FILE"
    
    cat >> "$REPORT_FILE" << EOF

CRITICAL FINDINGS:
- Review all VULN entries above immediately
- Implement proper input validation and sanitization
- Ensure authentication and authorization controls are working
- Fix any SQL injection or XSS vulnerabilities found

HIGH PRIORITY:
- Enable HTTPS if not already in use
- Implement proper session management
- Add file upload restrictions and validation
- Review API security configurations

MEDIUM PRIORITY:
- Implement proper error handling to avoid information disclosure
- Add security headers to all responses
- Review and harden SSL/TLS configuration
- Implement proper logging and monitoring

ONGOING SECURITY:
- Perform regular penetration testing
- Keep all dependencies updated
- Implement automated security scanning in CI/CD
- Conduct security code reviews

EOF
}

# Main execution
main() {
    print_status "Starting penetration testing suite..."
    
    information_gathering || exit 1
    authentication_testing
    input_validation_testing
    authorization_testing
    session_testing
    file_upload_testing
    api_security_testing
    ssl_testing
    generate_recommendations
    
    print_status "Penetration testing completed. Report saved to: $REPORT_FILE"
    
    # Summary
    echo "" >> "$REPORT_FILE"
    echo "TEST SUMMARY:" >> "$REPORT_FILE"
    echo "=============" >> "$REPORT_FILE"
    echo "Test completed at: $(date)" >> "$REPORT_FILE"
    echo "Report file: $REPORT_FILE" >> "$REPORT_FILE"
    
    print_success "Penetration testing report generated: $REPORT_FILE"
    
    # Count vulnerabilities
    vuln_count=$(grep -c "\[VULN\]" "$REPORT_FILE" || echo "0")
    warn_count=$(grep -c "\[WARN\]" "$REPORT_FILE" || echo "0")
    
    echo ""
    echo "SUMMARY:"
    echo "Vulnerabilities found: $vuln_count"
    echo "Warnings: $warn_count"
    
    if [ "$vuln_count" -gt 0 ]; then
        print_error "Critical vulnerabilities found! Review the report immediately."
        exit 1
    elif [ "$warn_count" -gt 0 ]; then
        print_warning "Security warnings found. Review and address them."
        exit 0
    else
        print_success "No critical vulnerabilities found."
        exit 0
    fi
}

# Run the penetration test
main "$@"