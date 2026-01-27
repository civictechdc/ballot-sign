#!/bin/bash
# Diagnostic script for ballot-backend 404 issue
set -e

echo "=== Ballot Backend Diagnostic Script ==="
echo

# 1. Check ballot-backend logs for startup errors
echo "1. Checking ballot-backend logs..."
echo "----------------------------------------"
docker logs ballot-backend --tail 50
echo

# 2. Test if the backend is responding internally
echo "2. Testing backend health endpoint..."
echo "----------------------------------------"
echo "Container IP:"
docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ballot-backend
echo
echo "Testing health endpoint:"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://ballot-backend:8001/health || echo "curl failed"
echo

# 3. Test the specific endpoint internally (without auth)
echo "3. Testing editable-list endpoint (expect 401 without auth)..."
echo "----------------------------------------"
curl -v -s http://ballot-backend:8001/api/ballot/initiatives/editable-list 2>&1 | grep -E "(< HTTP|< Location|> GET|> Authorization)" || true
echo

# 4. Check if nginx can reach the backend
echo "4. Testing nginx -> backend connectivity..."
echo "----------------------------------------"
docker exec nginx curl -s -o /dev/null -w "HTTP Status from nginx: %{http_code}\n" http://ballot-backend:8001/health || echo "nginx test failed"
echo

# 5. Check FastAPI route registration
echo "5. Checking FastAPI route registration..."
echo "----------------------------------------"
docker exec ballot-backend python -c "
from ballot_backend import app
routes = []
for route in app.routes:
    if hasattr(route, 'path'):
        routes.append(route.path)
    elif hasattr(route, 'routes'):
        for sub in route.routes:
            if hasattr(sub, 'path'):
                routes.append(sub.path)
for r in sorted(routes):
    if 'editable' in r or 'api/ballot' in r:
        print(r)
" || echo "Failed to check routes"
echo

# 6. Check for Python import errors
echo "6. Testing Python import..."
echo "----------------------------------------"
docker exec ballot-backend python -c "import ballot_backend; print('Import successful')" || echo "Import failed"
echo

# 7. Test the nginx proxy from outside
echo "7. Testing nginx proxy externally..."
echo "----------------------------------------"
curl -k -s -o /dev/null -w "External HTTPS Status: %{http_code}\n" https://ballot-vm.local/api/ballot/initiatives/editable-list || echo "External curl failed"
echo

echo "=== Diagnostic complete ==="