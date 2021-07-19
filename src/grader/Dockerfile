# syntax=docker/dockerfile:1

FROM openjdk:11

# Install node
RUN curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - && apt-get install -y nodejs

# Build isolate
RUN apt-get update -y && apt-get install build-essential libcap-dev -y
COPY ../../isolate isolate
RUN cd isolate && make isolate
RUN cd isolate && cp default.cf /usr/local/etc/isolate && cp ./isolate /usr/local/bin


ENV NODE_ENV=production
WORKDIR grader
COPY ["./package.json", "./yarn.lock", "./"]
RUN npm i -g yarn
RUN yarn
COPY . .

RUN yarn build

CMD [ "yarn", "start:grader" ]

