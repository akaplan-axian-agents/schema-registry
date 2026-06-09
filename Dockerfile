FROM node:24-alpine

ENV HOST=0.0.0.0 \
    PORT=8080 \
    SCHEMA_ROOT=/data/schemas \
    STATIC_ROOT=/app/src/static \
    VIEWS_ROOT=/app/views \
    LOCALES_ROOT=/app/locales \
    NODE_ENV=production

WORKDIR /app

RUN mkdir -p /data/schemas && chown -R node:node /data /app

COPY --chown=node:node package.json ./
COPY --chown=node:node dist ./dist
COPY --chown=node:node src/static ./src/static
COPY --chown=node:node views ./views
COPY --chown=node:node locales ./locales
COPY --chown=node:node schemas ./schemas

USER node

EXPOSE 8080

CMD ["node", "dist/server.js"]
