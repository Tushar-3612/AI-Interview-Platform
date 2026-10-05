# Secure Docker Execution Worker

Isolated, authenticated code execution microservice for the AI Interview Platform.

## Architecture

```
Vercel Frontend
      ↓ (HTTPS)
Render Backend
      ↓ (HTTPS + Bearer Secret)
Docker Execution Worker (e.g. Cloudflare Tunnel / VPS / Host)
      ↓
Docker Engine Sandbox
      ↓
Python / Java / C / C++ / JavaScript Isolated Containers
```

## Security Guarantees
- **Strict Authentication**: Every execution requires `Authorization: Bearer <CODE_EXECUTION_WORKER_SECRET>` (timing-safe comparison).
- **Zero Direct Docker Exposure**: Docker socket (`/var/run/docker.sock`) and Docker daemon ports are NEVER exposed to the public internet.
- **Micro-VM / Container Sandboxing**:
  - `--network none` (no outbound/inbound network inside student containers)
  - `--memory 256m` and `--memory-swap 256m`
  - `--cpus 0.5`
  - `--pids-limit 64`
  - `--read-only` root filesystem with tmpfs scratch space
  - `--user runner` (non-root execution)
  - `--rm` (automatic container destruction on completion)
- **Bounded Concurrency**: Uses an internal queue & semaphore to avoid container flooding. Returns HTTP 429 when queue is full.
- **Zero Native Code Execution**: Student code is NEVER executed on the host system.

## Endpoints

### 1. Health Check
`GET /health`
- **Auth**: None required (public health probe)
- **Response**:
  ```json
  {
    "status": "ok",
    "docker": "available",
    "runners": {
      "python": true,
      "java": true,
      "c": true,
      "cpp": true,
      "javascript": true
    },
    "uptime": 124.5
  }
  ```

### 2. Execute Code
`POST /execute`
- **Auth**: `Authorization: Bearer <CODE_EXECUTION_WORKER_SECRET>`
- **Body**:
  ```json
  {
    "language": "python",
    "code": "print('Hello, World!')",
    "stdin": "",
    "timeLimitMs": 5000,
    "memoryLimitMb": 256
  }
  ```

### 3. Execute Batch Test Suite
`POST /execute-suite`
- **Auth**: `Authorization: Bearer <CODE_EXECUTION_WORKER_SECRET>`
- **Body**:
  ```json
  {
    "language": "python",
    "code": "def solution(a, b): return a + b",
    "testCases": [
      { "input": "[1, 2]", "expectedOutput": "3", "isHidden": false },
      { "input": "[5, 7]", "expectedOutput": "12", "isHidden": true }
    ]
  }
  ```

## Local Development

```bash
# 1. Start worker on port 5050
cd docker-worker
node server.js

# 2. In backend .env, configure:
CODE_EXECUTION_WORKER_URL=http://localhost:5050
CODE_EXECUTION_WORKER_SECRET=your_dev_secret_key
```

## Production Deployment (e.g. via Cloudflare Tunnel)

1. Run the worker on any Docker-capable Linux server or VPS.
2. Expose the worker port securely over HTTPS using Cloudflare Tunnel (`cloudflared`):
   ```bash
   cloudflared tunnel --url http://localhost:5050
   ```
3. Set the resulting HTTPS URL in Render backend environment variables:
   ```env
   CODE_EXECUTION_WORKER_URL=https://worker.yourdomain.com
   CODE_EXECUTION_WORKER_SECRET=your_strong_production_secret
   ```
