#!/bin/bash

echo "🏥 Health Check - SkyHigh Check-In System (Docker)"
echo ""

check_service() {
  SERVICE_NAME=$1
  PORT=$2
  
  if curl -s -f "http://localhost:${PORT}/health" > /dev/null 2>&1; then
    echo "✅ $SERVICE_NAME (port $PORT) - HEALTHY"
    return 0
  else
    echo "❌ $SERVICE_NAME (port $PORT) - DOWN"
    return 1
  fi
}

echo "📊 Docker Container Status:"
docker-compose ps
echo ""

echo "🔍 Service Health Checks:"
check_service "API Gateway" 3000
check_service "Seat Service" 3001
check_service "Check-In Service" 3002
check_service "Payment Service" 3003
check_service "Waitlist Service" 3004
check_service "Notification Service" 3005
check_service "Weight Service" 3006
check_service "Abuse Detection Service" 3007

echo ""
echo "🗄️  Infrastructure:"
docker exec skyhigh-mongodb mongosh --eval "db.adminCommand('ping')" --quiet > /dev/null 2>&1 && echo "✅ MongoDB - CONNECTED" || echo "❌ MongoDB - DOWN"
docker exec skyhigh-redis redis-cli ping > /dev/null 2>&1 && echo "✅ Redis - CONNECTED" || echo "❌ Redis - DOWN"

echo ""
echo "📝 Quick Commands:"
echo "  View logs: npm run docker:logs"
echo "  Restart: npm run docker:restart"
echo "  Stop all: npm run docker:down"
