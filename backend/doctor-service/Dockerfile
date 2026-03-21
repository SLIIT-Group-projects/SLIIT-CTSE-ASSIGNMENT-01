FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

COPY src ./src

EXPOSE 4003
ENV PORT=4003

CMD ["node", "src/index.js"]

