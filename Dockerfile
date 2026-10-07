FROM node:22-alpine
WORKDIR /app

# primero las dependencias (se cachean si no cambia package.json)
COPY package*.json ./
RUN npm ci

# despues el codigo, y se compila back-end y front-end con TypeScript
COPY tsconfig*.json ./
COPY src ./src
COPY frontend ./frontend
RUN npm run build

EXPOSE 3000
CMD ["node", "dist/server.js"]
