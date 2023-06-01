FROM public.ecr.aws/lambda/nodejs:14

RUN yum install -y amazon-linux-extras zip unzip time yum-utils wget \
  && amazon-linux-extras install java-openjdk11 \
  && amazon-linux-extras enable python3.8 \
  && yum-config-manager --add-repo http://mirror.centos.org/centos/7/sclo/x86_64/rh/ \
  && wget http://mirror.centos.org/centos/7/os/x86_64/Packages/libgfortran5-8.3.1-2.1.1.el7.x86_64.rpm \
  && yum install libgfortran5-8.3.1-2.1.1.el7.x86_64.rpm -y \
  && yum install devtoolset-10 --nogpgcheck -y \
  && yum install devtoolset-10-libasan-devel.x86_64 devtoolset-10-libubsan-devel.x86_64 --nogpgcheck -y \
  && yum install -y python3.8 java-11-openjdk-devel \
  && yum clean all && rm -rf /var/cache/yum && rm libgfortran5-8.3.1-2.1.1.el7.x86_64.rpm

COPY package.json package-lock.json ./

RUN npm install

COPY tsconfig.json tsconfig.build.json jest.config.js ./
COPY src ./src

RUN npm run build

# Command can be overwritten by providing a different command in the template directly.
CMD ["dist/src/app.lambdaHandler"]
