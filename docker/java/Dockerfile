FROM eclipse-temurin:21-jdk-alpine

# Install timeout utility (coreutils provides GNU timeout with -s KILL support)
RUN apk add --no-cache coreutils

# Create non-root user
RUN adduser -D -h /home/runner runner

WORKDIR /workspace

USER runner