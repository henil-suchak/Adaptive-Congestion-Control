# ── Stage 1: Build the React frontend ───────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
COPY ScaledFrontEnd/congestion-frontend/package*.json ./
RUN npm ci
COPY ScaledFrontEnd/congestion-frontend/ .
RUN npm run build

# ── Stage 2: Serve via Nginx ────────────────────────────────────
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
