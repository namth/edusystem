FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY worker/ worker/
CMD ["node", "worker/grading-worker.js"]
