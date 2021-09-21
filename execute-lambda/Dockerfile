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

RUN npm install aws-lambda-ric

RUN mkdir -p ${FUNCTION_DIR}
COPY function/* ${FUNCTION_DIR}

# RUN npm install

FROM alpine:3.14

RUN apk --no-cache add nodejs npm g++ zip python3 openjdk11

ARG FUNCTION_DIR
WORKDIR ${FUNCTION_DIR}
COPY --from=build-image ${FUNCTION_DIR} ${FUNCTION_DIR}

ENTRYPOINT ["/usr/bin/npx", "aws-lambda-ric"]
CMD ["app.handler"]
