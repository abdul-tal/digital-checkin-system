#!/bin/bash

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}   SkyHigh Services - Restart Helper${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${YELLOW}📋 This script will help you restart all services with nodemon${NC}"
echo ""
echo -e "${GREEN}✅ All services are now configured with nodemon for auto-reload${NC}"
echo ""

echo -e "${BLUE}🔧 Services to run:${NC}"
echo "  1. API Gateway (Port 3000)      - npm run dev:gateway"
echo "  2. Seat Service (Port 3001)     - npm run dev:seat"
echo "  3. Check-In Service (Port 3002) - npm run dev:checkin"
echo "  4. Payment Service (Port 3003)  - npm run dev:payment"
echo "  5. Waitlist Service (Port 3004) - npm run dev:waitlist"
echo "  6. Notification Service (3005)  - npm run dev:notification"
echo "  7. Weight Service (Port 3006)   - npm run dev:weight"
echo "  8. Abuse Service (Port 3007)    - npm run dev:abuse"
echo ""

echo -e "${YELLOW}📝 Steps to restart:${NC}"
echo ""
echo -e "${BLUE}1. Stop all current services:${NC}"
echo "   - Press Ctrl+C in each terminal running a service"
echo ""

echo -e "${BLUE}2. Restart with nodemon (in separate terminals):${NC}"
echo ""
echo "   # Terminal 1: API Gateway"
echo "   npm run dev:gateway"
echo ""
echo "   # Terminal 2: Seat Service"
echo "   npm run dev:seat"
echo ""
echo "   # Terminal 3: Check-In Service"
echo "   npm run dev:checkin"
echo ""
echo "   # Terminal 4: Payment Service"
echo "   npm run dev:payment"
echo ""
echo "   # Terminal 5: Waitlist Service"
echo "   npm run dev:waitlist"
echo ""
echo "   # Terminal 6: Notification Service"
echo "   npm run dev:notification"
echo ""
echo "   # Terminal 7: Weight Service"
echo "   npm run dev:weight"
echo ""
echo "   # Terminal 8: Abuse Detection Service"
echo "   npm run dev:abuse"
echo ""

echo -e "${GREEN}✨ With nodemon, your services will:${NC}"
echo "   ✅ Auto-restart when you change .ts files"
echo "   ✅ Show which files triggered the restart"
echo "   ✅ Save you from manual restarts"
echo ""

echo -e "${YELLOW}💡 Pro tip: Use tmux or screen to manage multiple terminals${NC}"
echo ""
echo -e "${BLUE}tmux quick start:${NC}"
echo "   tmux new -s skyhigh          # Create session"
echo "   Ctrl+B then %                # Split vertical"
echo "   Ctrl+B then \"                # Split horizontal"
echo "   Ctrl+B then arrow keys       # Navigate panes"
echo "   Ctrl+B then D                # Detach"
echo "   tmux attach -t skyhigh       # Re-attach"
echo ""

echo -e "${GREEN}🚀 After restart, test the waitlist feature:${NC}"
echo "   ./scripts/test-waitlist-auto-complete.sh"
echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}   Ready to go! Start your services with nodemon${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
