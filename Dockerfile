FROM node:20-slim

ENV CI=true
ENV PORT=8080

WORKDIR /app

COPY . .

RUN corepack enable
RUN pnpm install
RUN pnpm --filter @publiclogic/core build
RUN pnpm --filter @publiclogic/puddlejumper build

EXPOSE 8080
CMD ["pnpm", "--filter", "@publiclogic/puddlejumper", "run", "start"]
