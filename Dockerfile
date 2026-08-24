# Calendar app image (used by Railway's Dockerfile builder).
FROM node:22-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

# Install production dependencies only, from the lockfile.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# App source.
COPY src ./src
COPY public ./public

# Directory for the JSON event store. Mount a Railway volume here
# (DATA_FILE defaults to /app/data/events.json) to persist events.
RUN mkdir -p /app/data

# Railway injects PORT at runtime; the server binds 0.0.0.0:$PORT.
EXPOSE 3000

CMD ["npm", "start"]
