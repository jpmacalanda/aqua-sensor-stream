
FROM node:20-alpine

WORKDIR /app

# Create logs directory and data directory
RUN mkdir -p /app/logs /app/data

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3001

# Use tini as init system
RUN apk add --no-cache tini wget
ENTRYPOINT ["/sbin/tini", "--"]

# Redirect logs to stdout and files for Docker logging
CMD ["sh", "-c", "node server.js 2>&1 | tee -a /app/logs/api.log"]
