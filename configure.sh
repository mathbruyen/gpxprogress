#!/bin/bash

# Configures the database

curl -X PUT $HOST/_config/admins/mathieu -d "\"$PASSWORD\""

curl -X POST $HOST/_session -H 'Content-Type:application/x-www-form-urlencoded' -c cookie -d "name=mathieu&password=$PASSWORD"

# Actual trace
curl -X PUT $HOST/trace -b cookie

# Planned trace
curl -X PUT $HOST/plan -b cookie

# Application
curl -X PUT $HOST/app -b cookie
curl -X PUT $HOST/app/app -H "Content-Type: application/json" -d '{}'

REV=$(curl -X GET $HOST/app/app | jq '._rev')
curl -X PUT $HOST/app/app/index.html -H "Content-Type: text/html" -H "If-Match: $REV" -d "@index.html"

REV=$(curl -X GET $HOST/app/app | jq '._rev')
curl -X PUT $HOST/app/app/favicon.png -H "Content-Type: image/png" -H "If-Match: $REV" --data-binary "@favicon.png"
