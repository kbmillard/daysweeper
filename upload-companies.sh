#!/bin/bash
# Upload companies.json to the import API
# Usage: ./upload-companies.sh [PRODUCTION_URL]

PROD_URL="${1:-https://daysweeper.vercel.app}"

echo "Uploading company.json to ${PROD_URL}/api/import/targets..."
echo ""

curl -X POST "${PROD_URL}/api/import/targets" \
  -H "Content-Type: application/json" \
  -d @company.json \
  | jq '.'

echo ""
echo "Done! Check the response above for the number of companies imported."
