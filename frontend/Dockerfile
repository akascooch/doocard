FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build output
COPY .next/standalone ./
COPY .next/static ./.next/static
COPY public ./public

# Ensure ownership and executable permissions on directories (incl. node_modules)
RUN chown -R nextjs:nodejs /app \
 && find /app -type d -exec chmod u+rwx,go+rx {} + \
 && find /app -type f -exec chmod u+rw,go+r {} +

USER nextjs
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
