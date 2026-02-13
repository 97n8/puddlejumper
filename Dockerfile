FROM node:20-slim

ENV CI=true

WORKDIR /app

COPY . .

RUN corepack enable
RUN pnpm install
RUN pnpm --filter @publiclogic/core build
RUN pnpm --filter @publiclogic/puddlejumper build

CMD ["pnpm", "--filter", "@publiclogic/puddlejumper", "run", "start"]
