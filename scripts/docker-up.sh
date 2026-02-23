#!/bin/bash

set -e

echo "🚀 Starting SkyHigh Check-In System with Docker..."
echo ""

echo "📦 Building Docker images..."
docker-compose build

echo ""
echo "🔧 Starting infrastructure (MongoDB + Redis)..."
docker-compose up -d mongodb redis redis-commander

echo ""
echo "⏳ Waiting for MongoDB to be ready..."
MAX_TRIES=30
TRIES=0
until docker exec skyhigh-mongodb mongosh --eval "db.adminCommand('ping')" --quiet > /dev/null 2>&1; do
  TRIES=$((TRIES+1))
  if [ $TRIES -eq $MAX_TRIES ]; then
    echo "❌ MongoDB failed to start after $MAX_TRIES attempts"
    exit 1
  fi
  echo "  Waiting for MongoDB... (attempt $TRIES/$MAX_TRIES)"
  sleep 2
done
echo "✅ MongoDB is ready"

echo ""
echo "🔧 Initializing MongoDB replica set..."
docker exec skyhigh-mongodb mongosh --eval '
try {
  var status = rs.status();
  if (status.members && status.members[0].name === "localhost:27017") {
    print("⚠️  Reconfiguring replica set to use mongodb hostname...");
    cfg = rs.conf();
    cfg.members[0].host = "mongodb:27017";
    rs.reconfig(cfg);
    print("✅ Replica set reconfigured");
  } else {
    print("✅ Replica set already initialized correctly");
  }
} catch(e) {
  print("🔧 Initializing new replica set...");
  rs.initiate({
    _id: "rs0",
    members: [{ _id: 0, host: "mongodb:27017" }]
  });
  print("✅ Replica set initialized");
}
' --quiet

echo ""
echo "⏳ Waiting for replica set to stabilize..."
sleep 3

echo "🔍 Verifying replica set configuration..."
docker exec skyhigh-mongodb mongosh --eval "rs.status().members[0].name" --quiet

echo ""
echo "🚀 Starting all microservices..."
docker-compose up -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

echo ""
echo "🌱 Seeding database with test data..."
docker exec skyhigh-api-gateway node -e "
const mongoose = require('mongoose');
(async () => {
  try {
    await mongoose.connect('mongodb://mongodb:27017/skyhigh?replicaSet=rs0', { 
      serverSelectionTimeoutMS: 5000 
    });
    const db = mongoose.connection.db;
    
    await db.collection('seats').deleteMany({});
    
    const seats = [];
    for (let row = 1; row <= 30; row++) {
      for (const col of ['A', 'B', 'C', 'D', 'E', 'F']) {
        const isPremium = row <= 5;
        const type = ['A', 'F'].includes(col) ? 'WINDOW' : ['B', 'E'].includes(col) ? 'MIDDLE' : 'AISLE';
        seats.push({
          seatId: \`\${row}\${col}\`,
          flightId: 'SK123',
          row,
          column: col,
          state: 'AVAILABLE',
          type,
          price: isPremium ? 50 : 25,
          isEmergencyExit: [12, 13].includes(row),
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }
    
    await db.collection('seats').insertMany(seats);
    console.log('✅ Seeded \${seats.length} seats for flight SK123');
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  }
})();
" || echo "⚠️  Seed failed - you may need to run manually"

echo ""
echo "✅ All services are up and running!"
echo ""
echo "📊 Service Status:"
docker-compose ps

echo ""
echo "🔗 Endpoints:"
echo "  API Gateway:      http://localhost:3000"
echo "  Seat Service:     http://localhost:3001"
echo "  Check-In Service: http://localhost:3002"
echo "  Payment Service:  http://localhost:3003"
echo "  Waitlist Service: http://localhost:3004"
echo "  Notify Service:   http://localhost:3005"
echo "  Weight Service:   http://localhost:3006"
echo "  Abuse Service:    http://localhost:3007"
echo "  Redis Commander:  http://localhost:8081"
echo ""
echo "📝 Next steps:"
echo "  - Import postman/Demo_Scenarios.postman_collection.json"
echo "  - View logs: npm run docker:logs"
echo "  - Stop all: npm run docker:down"
