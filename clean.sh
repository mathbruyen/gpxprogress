#!/bin/bash

# Cleans the database

curl -X POST $HOST/_session -H 'Content-Type:application/x-www-form-urlencoded' -c cookie -d "name=mathieu&password=$PASSWORD"

# Actual trace
curl -X DELETE $HOST/trace -b cookie

# Planned trace
curl -X DELETE $HOST/plan -b cookie

# Application
curl -X DELETE $HOST/app -b cookie

# User
curl -X DELETE $HOST/_config/admins/mathieu -b cookie
