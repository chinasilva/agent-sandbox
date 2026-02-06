#!/bin/bash
# User System Test Script
# Run this to test the new user system functionality

echo "🧪 Agent Sandbox - User System Tests"
echo "======================================"
echo ""

# Check if server is running
echo "1. Checking server status..."
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Server is running"
else
    echo "⚠️  Server not running. Starting it..."
    cd /root/.openclaw/workspace/aicode/agent-sandbox
    npm start &
    echo "Waiting for server to start..."
    sleep 5
    
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo "✅ Server started"
    else
        echo "❌ Server failed to start. Please run 'npm start' manually"
        exit 1
    fi
fi

echo ""
echo "2. Running user system integration tests..."
echo ""

# Run the tests
cd /root/.openclaw/workspace/aicode/agent-sandbox
node --test tests/user-system.test.js

echo ""
echo "======================================"
echo "✅ Tests completed!"
