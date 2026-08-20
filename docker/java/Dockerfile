FROM eclipse-temurin:21-jdk-alpine

# Install timeout utility
RUN apk add --no-cache coreutils

# Create non-root user
RUN adduser -D -h /home/runner runner

WORKDIR /workspace

# Copy runner script
COPY run.sh /run.sh
RUN chmod +x /run.sh && chown runner:runner /run.sh

USER runner

ENTRYPOINT ["/run.sh"]