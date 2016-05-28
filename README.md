# Live GPS tracker

## Development

With Node.js locally installed:

```
# Install dependencies
npm install

# Dev server
npm run watch

# Build of frontend resources
npm run build
```

Alternatively, Docker based environment:

```
# Prepare image with dependencies installed
docker build -f Dockerfile.build -t gpxprogress .

# Dev server
docker run --rm -p 8080:8080 -v $(pwd)/src:/gpxprogress/src -it gpxprogress watch

# Build of frontend resources
docker run --rm -v $(pwd)/dist:/gpxprogress/dist gpxprogress build
```
