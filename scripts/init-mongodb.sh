#!/bin/bash

echo "🔧 Initializing MongoDB replica set..."

# Wait for MongoDB to be ready
echo "⏳ Waiting for MongoDB to be ready..."
sleep 5

# Initialize replica set
docker exec skyhigh-mongodb mongosh --eval "
try {
  rs.status();
  print('✅ Replica set already initialized');
} catch (e) {
  rs.initiate({
    _id: 'rs0',
    members: [{ _id: 0, host: 'localhost:27017' }]
  });
  print('✅ Replica set initialized successfully');
}
"

echo ""
echo "🗄️  Creating database and collections..."

docker exec skyhigh-mongodb mongosh --eval "
use skyhigh;
db.createCollection('seats');
db.createCollection('checkins');
db.createCollection('waitlists');
db.createCollection('payments');
db.createCollection('access_logs');
print('✅ Collections created successfully');
"

echo ""
echo "✅ MongoDB initialization complete!"
echo "📝 You can now run: npm run seed"
