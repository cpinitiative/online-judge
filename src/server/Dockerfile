# syntax=docker/dockerfile:1

FROM node:14

ENV NODE_ENV=production
WORKDIR server
COPY ["./package.json", "./yarn.lock", "./"]
RUN yarn
COPY . .

RUN yarn build

EXPOSE 443

CMD [ "yarn", "start:server" ]

