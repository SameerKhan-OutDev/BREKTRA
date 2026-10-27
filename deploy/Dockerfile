FROM node:24-bookworm-slim
ENV NODE_ENV=production BREKTRA_HOSTED=1 BREKTRA_BIND_HOST=127.0.0.1 PORT=4310
WORKDIR /app
COPY --chown=node:node server.mjs THIRD-PARTY-NOTICES.txt ./
COPY --chown=node:node dist ./dist
COPY --chown=node:node docs ./docs
RUN mkdir -p /app/.runtime && chown node:node /app/.runtime
USER node
VOLUME ["/app/.runtime"]
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4310)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.mjs", "--production"]
