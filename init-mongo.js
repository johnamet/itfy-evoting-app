#!/usr/bin/env node
db = db.getSiblingDB('admin');

// Create a root user
db.createUser({
  user: "itfy-user",
  pwd: "itfy-password",
  roles: [
    { role: "userAdminAnyDatabase", db: "admin" },
    { role: "readWriteAnyDatabase", db: "admin" }
  ]
});