FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY uploads ./uploads

EXPOSE 4004
ENV PORT=4004

CMD ["node", "src/index.js"]

