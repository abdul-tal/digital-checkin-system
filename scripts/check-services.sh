#!/bin/bash

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}   SkyHigh Services - Health Check${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

check_service() {
  local name=$1
  local port=$2
  local endpoint=${3:-/health}
  
  if curl -s -f "http://localhost:${port}${endpoint}" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} ${name} (port ${port}) - ${GREEN}RUNNING${NC}"
    return 0
  else
    echo -e "  ${RED}✗${NC} ${name} (port ${port}) - ${RED}NOT RUNNING${NC}"
    return 1
  fi
}

echo -e "${YELLOW}📊 Checking service status...${NC}"
echo ""

all_ok=true

check_service "API Gateway" 3000 || all_ok=false
check_service "Seat Service" 3001 || all_ok=false
check_service "Check-In Service" 3002 || all_ok=false
check_service "Payment Service" 3003 || all_ok=false
check_service "Waitlist Service" 3004 || all_ok=false
check_service "Notification Service" 3005 || all_ok=false
check_service "Weight Service" 3006 || all_ok=false
check_service "Abuse Detection Service" 3007 || all_ok=false

echo ""
echo -e "${YELLOW}🐳 Checking dependencies...${NC}"
echo ""

# Check Redis
if docker ps | grep -q redis; then
  echo -e "  ${GREEN}✓${NC} Redis - ${GREEN}RUNNING${NC}"
else
  echo -e "  ${RED}✗${NC} Redis - ${RED}NOT RUNNING${NC}"
  echo -e "     ${YELLOW}Start with: docker-compose up -d${NC}"
  all_ok=false
fi

# Check MongoDB
if docker ps | grep -q mongo; then
  echo -e "  ${GREEN}✓${NC} MongoDB - ${GREEN}RUNNING${NC}"
else
  echo -e "  ${RED}✗${NC} MongoDB - ${RED}NOT RUNNING${NC}"
  echo -e "     ${YELLOW}Start with: docker-compose up -d${NC}"
  all_ok=false
fi

echo ""
echo -e "${YELLOW}⚙️  Configuration...${NC}"
echo ""

# Check .env
if [ -f ".env" ]; then
  HOLD_DURATION=$(grep "^SEAT_HOLD_DURATION_SECONDS=" .env | cut -d'=' -f2)
  if [ -n "$HOLD_DURATION" ]; then
    echo -e "  ${GREEN}✓${NC} SEAT_HOLD_DURATION_SECONDS: ${HOLD_DURATION}s"
    if [ "$HOLD_DURATION" -gt 30 ]; then
      echo -e "     ${YELLOW}⚠️  Consider setting to 20s for faster testing${NC}"
    fi
  else
    echo -e "  ${YELLOW}⚠${NC} SEAT_HOLD_DURATION_SECONDS: Not set (default: 120s)"
  fi
else
  echo -e "  ${RED}✗${NC} .env file not found"
  all_ok=false
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if $all_ok; then
  echo -e "${GREEN}✅ All systems operational!${NC}"
  echo -e "${GREEN}   Ready to run: ./scripts/test-waitlist-auto-complete.sh${NC}"
else
  echo -e "${RED}❌ Some services are not running${NC}"
  echo -e "${YELLOW}   Fix the issues above, then run this script again${NC}"
  exit 1
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
