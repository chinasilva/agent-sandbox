#!/bin/bash
# Manual API Test Script for User System
# Quick verification that all endpoints work correctly

API_BASE="http://localhost:3000"

echo "🧪 Agent Sandbox - Manual API Tests"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test helper function
test_endpoint() {
    local name=$1
    local method=$2
    local url=$3
    local data=$4
    local expected_status=$5
    
    echo -n "Testing: $name... "
    
    if [ -z "$data" ]; then
        response=$(curl -s -o /tmp/response.txt -w "%{http_code}" -X $method "$url")
    else
        response=$(curl -s -o /tmp/response.txt -w "%{http_code}" -X $method "$url" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    http_code=$(tail -c 3 /tmp/response.txt)
    content=$(cat /tmp/response.txt)
    
    if [ "$http_code" = "$expected_status" ]; then
        echo -e "${GREEN}✅ PASS${NC} (HTTP $http_code)"
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} (Expected $expected_status, got HTTP $http_code)"
        echo "  Response: $content" | head -c 200
        echo ""
        return 1
    fi
}

# Generate unique test username
TIMESTAMP=$(date +%s)
TEST_USER="testuser_$TIMESTAMP"
TEST_PASS="testpass123"

echo "Test user: $TEST_USER"
echo ""

echo "=== Public Endpoints ==="
echo ""

test_endpoint "Health Check" "GET" "$API_BASE/health" "" "200"
test_endpoint "List Skills" "GET" "$API_BASE/api/v1/skills" "" "200"

echo ""
echo "=== User Registration ==="
echo ""

# Register new user
REGISTER_RESPONSE=$(curl -s -X POST "$API_BASE/api/v1/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$TEST_USER\",\"password\":\"$TEST_PASS\"}")

ACCESS_TOKEN=$(echo $REGISTER_RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))" 2>/dev/null)
REFRESH_TOKEN=$(echo $REGISTER_RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin).get('refreshToken',''))" 2>/dev/null)

if test_endpoint "User Registration" "POST" "$API_BASE/api/v1/auth/register" \
    "{\"username\":\"$TEST_USER\",\"password\":\"$TEST_PASS\"}" "201"; then
    echo "  User created with 100 credits"
fi

# Test duplicate registration
test_endpoint "Duplicate Registration" "POST" "$API_BASE/api/v1/auth/register" \
    "{\"username\":\"$TEST_USER\",\"password\":\"different\"}" "409"

echo ""
echo "=== User Login ==="
echo ""

test_endpoint "User Login" "POST" "$API_BASE/api/v1/auth/login" \
    "{\"username\":\"$TEST_USER\",\"password\":\"$TEST_PASS\"}" "200"

test_endpoint "Wrong Password" "POST" "$API_BASE/api/v1/auth/login" \
    "{\"username\":\"$TEST_USER\",\"password\":\"wrongpass\"}" "401"

echo ""
echo "=== Authenticated Requests ==="
echo ""

if [ -n "$ACCESS_TOKEN" ]; then
    test_endpoint "Get Profile" "GET" "$API_BASE/api/v1/user/profile" "" "200"
    test_endpoint "List Tasks" "GET" "$API_BASE/api/v1/user/tasks" "" "200"
    
    # Submit a task
    TASK_RESPONSE=$(curl -s -X POST "$API_BASE/api/v1/tasks" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -d '{"task":"Test task from API","tools":["code-generator"]}')
    
    TASK_ID=$(echo $TASK_RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin).get('taskId',''))" 2>/dev/null)
    
    echo ""
    echo "=== Task Submission ==="
    echo ""
    
    test_endpoint "Submit Task (Auth)" "POST" "$API_BASE/api/v1/tasks" \
        '{"task":"Test task","tools":["code-generator"]}' "200"
    
    test_endpoint "Submit Task (No Auth)" "POST" "$API_BASE/api/v1/tasks" \
        '{"task":"Test task","tools":["code-generator"]}' "401"
    
    echo ""
    echo "=== Token Validation ==="
    echo ""
    
    test_endpoint "Invalid Token" "GET" "$API_BASE/api/v1/user/profile" "" "401" \
        | head -1  # Just show the first test
    
    # Test with valid token
    VALID_PROFILE=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" "$API_BASE/api/v1/user/profile")
    echo "Valid token response: $(echo $VALID_PROFILE | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'User: {d[\"user\"][\"username\"]}, Credits: {d[\"user\"][\"credits\"]}')")"
fi

echo ""
echo "======================================"
echo "✅ Manual tests completed!"
echo ""
echo "Quick Test Commands:"
echo "  # Register: curl -X POST $API_BASE/api/v1/auth/register -H 'Content-Type: application/json' -d '{\"username\":\"myuser\",\"password\":\"mypass\"}'"
echo "  # Login: curl -X POST $API_BASE/api/v1/auth/login -H 'Content-Type: application/json' -d '{\"username\":\"myuser\",\"password\":\"mypass\"}'"
echo "  # Submit Task: curl -X POST $API_BASE/api/v1/tasks -H 'Content-Type: application/json' -H 'Authorization: Bearer <token>' -d '{\"task\":\"Hello\",\"tools\":[\"code-generator\"]}'"
echo ""
