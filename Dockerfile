FROM node:24-alpine AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:24-alpine AS runtime

ENV HOST=0.0.0.0 \
    PORT=8080 \
    SCHEMA_ROOT=/data/schemas \
    STATIC_ROOT=/app/src/static \
    VIEWS_ROOT=/app/views \
    LOCALES_ROOT=/app/locales \
    NODE_ENV=production

WORKDIR /app

RUN mkdir -p /data/schemas && chown -R node:node /data /app

COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node views ./views
COPY --chown=node:node locales ./locales
COPY --chown=node:node schemas ./schemas

USER node

EXPOSE 8080

CMD ["npm", "start"]
