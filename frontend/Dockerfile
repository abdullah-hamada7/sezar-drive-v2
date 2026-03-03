# Frontend Dockerfile — multi-stage build
FROM node:22-alpine AS build
WORKDIR /app

# Copy shared contracts
COPY packages/contracts /packages/contracts

# Copy frontend manifests
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

COPY frontend/ .
RUN npm run build

# Production — serve with nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
