# Stage 1: build the static bundle
FROM node:22-alpine AS build
WORKDIR /app
# husky's prepare hook has no .git to install into inside the image
ENV HUSKY=0
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Same-origin by default: nginx below proxies /api to the backend, so the bundle
# never needs to know the API host.
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# Stage 2: serve it
FROM nginx:1.27-alpine
# The nginx image renders /etc/nginx/templates/*.template with envsubst at start,
# which is how API_UPSTREAM gets in.
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
ENV API_UPSTREAM=api:8080
EXPOSE 80
