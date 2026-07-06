FROM eclipse-temurin:21-jdk-alpine
WORKDIR /app

RUN apk add --no-cache \
    git \
    curl \
    wget \
    vim \
    maven \
    bash \
    tesseract-ocr \
    tesseract-ocr-data-jpn \
    tesseract-ocr-data-eng

CMD ["tail", "-f", "/dev/null"]