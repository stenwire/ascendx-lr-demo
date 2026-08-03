FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
# The schema has to be in place before npm install, because the postinstall hook
# runs `prisma generate` against it.
COPY prisma ./prisma
RUN npm install

COPY . .

EXPOSE 4000

# Applies any pending migrations against DATABASE_URL, then starts the dev server
# (tsx watch) so bind-mounted source changes hot-reload inside the container.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run dev"]
