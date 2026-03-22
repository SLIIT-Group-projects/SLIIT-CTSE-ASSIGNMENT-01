FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

COPY src ./src
COPY uploads ./uploads

EXPOSE 4005
ENV PORT=4005

CMD ["node", "src/index.js"]

