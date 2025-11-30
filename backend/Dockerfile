FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Spring開発に必要なパッケージをインストール
RUN apk add --no-cache \
    git \
    curl \
    wget \
    vim \
    maven \
    gradle \
    bash

# コンテナを起動し続ける
CMD ["tail", "-f", "/dev/null"]

