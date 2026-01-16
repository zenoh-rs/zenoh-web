# This dockerfile is expecting to be run with the following build command
# (from the root of the git repository):
#
# $ docker build -f docker/Dockerfile -t zenoh_web .
#
# Then, to use the image to build the docs:
#
# $ docker run --rm -v $(pwd):/src -p 1313:1313 zenoh_web

FROM ubuntu:noble

ARG user=hugo
ARG uid=1000

ENV DEBIAN_FRONTEND=noninteractive
ENV SHELL=/bin/bash

# Delete user if it exists in container (e.g Ubuntu Noble: ubuntu)
RUN if id -u $uid ; then userdel `id -un $uid` ; fi

RUN apt-get update && \
    apt-get install --no-install-recommends -y \
        curl \
        git \
        ca-certificates \
        locales && \
    rm -rf /var/lib/apt/lists/*

RUN locale-gen en_US en_US.UTF-8
RUN update-locale LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8
ENV LANG=en_US.UTF-8

RUN useradd -u $uid -m $user

ENV HOME=/home/$user
ENV VERSION=0.145.0

RUN mkdir -p /usr/local/src \
    && cd /usr/local/src \
    && curl -L https://github.com/gohugoio/hugo/releases/download/v${VERSION}/hugo_${VERSION}_linux-amd64.tar.gz | tar -xz \
    && mv hugo /usr/local/bin/hugo \
    && chmod +x /usr/local/bin/hugo

USER $user
WORKDIR /src

EXPOSE 1313

CMD ["hugo", "server"]
