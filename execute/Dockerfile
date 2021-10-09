FROM public.ecr.aws/lambda/nodejs:14

RUN yum install -y gcc-c++ amazon-linux-extras zip unzip time \
  && amazon-linux-extras install java-openjdk11 \
  && amazon-linux-extras enable python3.8 \
  && yum install -y python3.8 java-11-openjdk-devel \
  && yum clean all && rm -rf /var/cache/yum

COPY package.json package-lock.json ./

RUN npm install

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src

RUN npm run build

# Command can be overwritten by providing a different command in the template directly.
CMD ["dist/src/app.lambdaHandler"]
