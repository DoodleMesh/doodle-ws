FROM node:21.7.3

WORKDIR /app

COPY package*.json .

RUN corepack enable pnpm

RUN pnpm install

COPY . .

EXPOSE 8080

RUN pnpm prisma generate

CMD ["pnpm","run","dev"]
