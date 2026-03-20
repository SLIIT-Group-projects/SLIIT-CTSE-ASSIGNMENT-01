FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY uploads ./uploads

EXPOSE 4005
ENV PORT=4005

CMD ["node", "src/index.js"]

