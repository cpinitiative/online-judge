# Define custom function directory
ARG FUNCTION_DIR="/function"

FROM alpine:3.14 as build-image

# Include global arg in this stage of the build
ARG FUNCTION_DIR

RUN apk --no-cache add \
    g++ \
    make \
    cmake \
    unzip \
    curl-dev \
    automake \
    autoconf \
    tar \
    gzip \
    libtool \
    libexecinfo-dev \
    python3 \
    nodejs \
    npm

WORKDIR ${FUNCTION_DIR}

RUN npm install -g yarn

RUN mkdir -p ${FUNCTION_DIR}
COPY function/package.json ${FUNCTION_DIR}/package.json
COPY function/yarn.lock ${FUNCTION_DIR}/yarn.lock

RUN yarn install
RUN yarn add aws-lambda-ric

FROM alpine:3.14

RUN apk --no-cache add nodejs npm

ARG FUNCTION_DIR
WORKDIR ${FUNCTION_DIR}
COPY --from=build-image ${FUNCTION_DIR} ${FUNCTION_DIR}

COPY function/* ${FUNCTION_DIR}/

ENTRYPOINT ["/usr/bin/npx", "aws-lambda-ric"]
CMD ["app.handler"]
