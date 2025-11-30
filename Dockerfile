FROM node:18-alpine AS base
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install --production

COPY src ./src
COPY public ./public
COPY data ./data

EXPOSE 4000
CMD ["node", "src/server.js"]
