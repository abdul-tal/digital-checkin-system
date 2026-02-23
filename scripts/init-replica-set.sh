#!/bin/bash

echo "Waiting for MongoDB to be ready..."
sleep 5

echo "Initializing MongoDB replica set..."
mongosh --host localhost:27017 <<EOF
try {
  rs.status();
  print("✅ Replica set already initialized");
} catch(e) {
  rs.initiate({
    _id: "rs0",
    members: [
      { _id: 0, host: "mongodb:27017" }
    ]
  });
  print("✅ Replica set initialized");
}
EOF

echo "✅ MongoDB replica set ready"
