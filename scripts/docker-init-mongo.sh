#!/bin/bash

set -e

echo "🔧 Initializing MongoDB replica set for Docker environment..."

# Wait for MongoDB to be ready
echo "⏳ Waiting for MongoDB to accept connections..."
until docker exec skyhigh-mongodb mongosh --eval "db.adminCommand('ping')" --quiet > /dev/null 2>&1; do
  sleep 2
done

echo "✅ MongoDB is ready"

# Check if replica set is already initialized
RS_STATUS=$(docker exec skyhigh-mongodb mongosh --eval "rs.status().ok" --quiet 2>/dev/null || echo "0")

if [ "$RS_STATUS" = "1" ]; then
  echo "✅ Replica set already initialized"
else
  echo "🔧 Initializing replica set..."
  docker exec skyhigh-mongodb mongosh --eval '
    rs.initiate({
      _id: "rs0",
      members: [
        { _id: 0, host: "mongodb:27017" }
      ]
    })
  '
  
  echo "⏳ Waiting for replica set to stabilize..."
  sleep 5
  
  echo "✅ Replica set initialized successfully"
fi

echo ""
echo "🎉 MongoDB is ready for use!"
echo ""
echo "Next steps:"
echo "  1. Run seed data: docker exec skyhigh-api-gateway npm run seed"
echo "  2. Test the system: import postman/Demo_Scenarios.postman_collection.json"
