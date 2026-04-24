# Distributed Task Queue System

A production-grade Node.js/TypeScript backend system for managing and processing distributed background jobs with strong reliability, observability, and failure-handling guarantees. This system provides a complete solution for asynchronous job processing with comprehensive monitoring, reliability guarantees, and advanced job scheduling capabilities.

**Author:** Sumanth Bojugu  
**License:** MIT  
**Repository:** [GitHub](https://github.com/theSumanth/distributed-task-queue-system)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Job Processing](#job-processing)
- [Monitoring & Metrics](#monitoring--metrics)
- [Development](#development)
- [Scripts](#scripts)
- [Environment Variables](#environment-variables)
- [Error Handling](#error-handling)
- [Architecture Patterns](#architecture-patterns)

---

## 🎯 Overview

The **Distributed Task Queue System** is a production-grade job queue implementation designed to:

- **Manage async jobs reliably** - Execute long-running operations asynchronously without blocking HTTP requests
- **Ensure delivery guarantees** - Implement the transactional outbox pattern for at-least-once delivery between database and queue
- **Scale horizontally** - Support multiple worker instances processing jobs concurrently
- **Provide visibility** - Comprehensive job tracking, event logging, and Prometheus metrics
- **Handle failures gracefully** - Automatic retries with exponential backoff and dead-letter queue support
- **Enable job scheduling** - Support delayed execution, scheduled times, and cron expressions

### Use Cases

- **Email delivery** - Queue and send emails asynchronously
- **Webhook invocations** - Call external webhooks with automatic retries
- **Background processing** - Handle any generic async work (image processing, data export, etc.)
- **Event sourcing** - Reliable event distribution using the outbox pattern
- **Task scheduling** - Execute jobs at specific times or intervals

---

## ✨ Key Features

### Job Management

- **Create jobs** via REST API with flexible payload configuration
- **Query job status** with pagination and filtering
- **Cancel pending jobs** before execution
- **Track job events** with full audit trail
- **Job priorities** - High, normal, and low priority queues
- **Multiple job types** - Email, webhook, and generic job processing

### Scheduling & Execution

- **Delayed execution** - Execute jobs after N milliseconds
- **Scheduled execution** - Run jobs at specific ISO datetime
- **Cron scheduling** - Recurring job execution (framework ready)
- **Configurable retries** - 0-20 retry attempts with exponential backoff
- **Max retry limits** - Prevent infinite retry loops

### Reliability & Resilience

- **Transactional outbox pattern** - Ensures job enqueuing is atomically persisted
- **Dead letter queue** - Separate queue for permanently failed jobs
- **Automatic retry logic** - Exponential backoff with configurable delays
- **Job state transitions** - Track queued → active → completed/failed/cancelled
- **Error tracking** - Store detailed error information and stacktraces

### Monitoring & Observability

- **Prometheus metrics** - Comprehensive metrics for jobs, queues, database, and HTTP requests
- **Health checks** - Basic and detailed health endpoints
- **Structured logging** - Pino logger with correlation IDs
- **Request tracking** - X-Correlation-ID header support
- **Per-process metrics** - Separate metrics endpoints for API, queue worker, and outbox worker

### API Security & Performance

- **Rate limiting** - Configurable request rate limits
- **CORS support** - Configurable cross-origin resource sharing
- **Helmet security headers** - OWASP security best practices
- **Request validation** - Zod schema validation for all inputs
- **OpenAPI/Swagger documentation** - Auto-generated interactive API docs

---

## 🏗️ Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                     API Server (Port 8080)                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Express.js + Security Middleware + Rate Limiting        │  │
│  │  ├─ POST /api/v1/jobs (Create job)                       │  │
│  │  ├─ GET /api/v1/jobs (List jobs)                         │  │
│  │  ├─ GET /api/v1/jobs/:id (Get job details)              │  │
│  │  ├─ DELETE /api/v1/jobs/:id (Cancel job)                │  │
│  │  ├─ GET /health (Basic health check)                    │  │
│  │  ├─ GET /health/detailed (Full dependency check)        │  │
│  │  ├─ GET /docs (OpenAPI Swagger UI)                      │  │
│  │  └─ GET /metrics (Prometheus metrics)                   │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
         │                                                  │
         ▼                                                  ▼
┌──────────────────┐                              ┌──────────────────┐
│   PostgreSQL     │                              │   Redis Queue    │
│   ┌──────────┐   │                              │                  │
│   │ jobs     │   │    ◄─────────────────────►   │  Main Queue      │
│   │ events   │   │       Job Enqueue            │  Dead Letter     │
│   │ outbox   │   │                              │  Queue           │
│   └──────────┘   │                              └──────────────────┘
└──────────────────┘                                      ▲
         ▲                                                 │
         │                                        Job Execution
         │                              ┌──────────────────────────┐
         └──────────────────────────────┤ Queue Worker Process     │
         (Update job status)            │ ┌────────────────────┐   │
                                        │ │ Email Handler      │   │
                                        │ │ Webhook Handler    │   │
                                        │ │ Generic Handler    │   │
                                        │ │ Processor Registry │   │
                                        │ └────────────────────┘   │
                                        │ Metrics: :8080/metrics   │
                                        └──────────────────────────┘

Outbox Pattern Implementation:
         ┌──────────────────┐
         │  Outbox Worker   │
         │  Process Polls   │
         │  outbox table    │
         │  every 2 seconds │
         └──────────────────┘
                 │
    ┌────────────┴────────────┐
    │                         │
    ▼                         ▼
┌─────────────┐      ┌──────────────────┐
│ Job Enqueue │      │ DLQ Enqueue      │
│ into Redis  │      │ (if max retries) │
└─────────────┘      └──────────────────┘
```

### Data Flow

1. **Job Creation**
   - Client sends POST request to `/api/v1/jobs`
   - API validates payload and creates job record in PostgreSQL
   - Outbox event created atomically in same transaction
   - Job event created (status: "queued")
   - Response returned to client immediately

2. **Job Enqueuing**
   - Outbox worker polls `outbox_events` table every 2 seconds
   - Enqueues job into Redis queue (BullMQ)
   - Marks outbox event as "processed"

3. **Job Processing**
   - Queue worker pulls job from Redis
   - Updates job status to "active" in PostgreSQL
   - Executes appropriate job handler (email/webhook/generic)
   - On success: Updates status to "completed", stores result
   - On failure: Retries up to max_retries with exponential backoff
   - On permanent failure: Moves to dead letter queue

4. **Job Status Updates**
   - Job events created for each state transition
   - Client can query `/api/v1/jobs/:id` to get full job history

### Deployment Model

- **Containerized** - Docker multi-stage build
- **Stateless API** - Can run multiple instances behind load balancer
- **Stateless workers** - Queue worker instances process jobs concurrently
- **External persistence** - PostgreSQL + Redis handle all state
- **Horizontal scaling** - Add more worker instances for higher throughput

---

## 🛠️ Technology Stack

### Core Framework

- **Node.js** 20+ (Alpine Linux in Docker)
- **TypeScript** 5.9 - Type-safe development
- **Express.js** 5.x - HTTP server framework

### Data & Messaging

- **PostgreSQL** 16 - Relational database
- **Redis** 7 - In-memory data structure store
- **BullMQ** 5.71 - Redis-based job queue library

### APIs & Documentation

- **Zod** 4.3 - Schema validation and parsing
- **Swagger UI Express** 5.0 - OpenAPI documentation UI
- **Zod to OpenAPI** 8.5 - Auto-generate OpenAPI specs from Zod schemas

### Observability

- **Pino** 10.3 - Structured logging
- **Pino HTTP** 11.0 - HTTP request logging
- **Prometheus Client** 15.1 - Metrics collection and export

### Security & Quality

- **Helmet** 8.1 - HTTP security headers
- **CORS** 2.8 - Cross-origin resource sharing
- **Express Rate Limit** 8.3 - Request rate limiting
- **ESLint** 10.0 + Prettier 3.8 - Code quality and formatting
- **dotenv** 17.3 - Environment variable management

### Build & Development

- **tsup** 8.5 - TypeScript bundler (CommonJS output)
- **tsx** 4.21 - Execute TypeScript directly
- **cross-env** 10.1 - Cross-platform environment variables

---

## 📁 Project Structure

```
distributed-task-queue-system/
├── src/
│   ├── index.ts                          # Entry point (API server startup)
│   │
│   ├── api/                              # HTTP API layer
│   │   ├── app.ts                        # Express app setup with middleware
│   │   ├── controllers/
│   │   │   ├── index.ts
│   │   │   └── jobs.controller.ts        # Job endpoints handlers
│   │   ├── routes/
│   │   │   ├── jobs.routes.ts           # Job CRUD routes
│   │   │   ├── health.routes.ts         # Health check routes
│   │   │   └── docs.routes.ts           # OpenAPI docs routes
│   │   ├── schemas/
│   │   │   ├── job.schema.ts            # Zod schemas for jobs API
│   │   │   ├── health.schema.ts         # Health check schemas
│   │   │   └── api.schema.ts            # Common API schemas
│   │   ├── docs/
│   │   │   ├── openapi.registry.ts      # OpenAPI schema registry
│   │   │   ├── openapi.generator.ts     # OpenAPI generator
│   │   │   ├── jobs.openapi.ts          # Job endpoints OpenAPI specs
│   │   │   └── health.openapi.ts        # Health endpoints OpenAPI specs
│   │   ├── errors/
│   │   │   └── app-error.ts             # Error types and handlers
│   │   ├── middlewares/
│   │   │   └── validate.ts              # Request validation middleware
│   │   └── utils/
│   │       └── response.ts              # Response formatting utilities
│   │
│   ├── config/                           # Configuration management
│   │   ├── index.ts                      # Main config export (parses all)
│   │   ├── app.config.ts                # App-level config (port, env)
│   │   ├── database.config.ts           # PostgreSQL connection config
│   │   ├── redis.config.ts              # Redis connection config
│   │   ├── queue.config.ts              # BullMQ queue config
│   │   ├── worker.config.ts             # Queue worker config
│   │   ├── outbox.config.ts             # Outbox pattern config
│   │   ├── security.config.ts           # CORS, rate limit, helmet
│   │   ├── logging.config.ts            # Pino logger config
│   │   ├── metrics.config.ts            # Prometheus metrics config
│   │   ├── features.config.ts           # Feature flags
│   │   └── helpers/
│   │       └── boolean.ts               # Config parsing helpers
│   │
│   ├── core/                             # Core infrastructure
│   │   ├── logger.ts                    # Pino logger setup & middleware
│   │   ├── metrics/
│   │   │   ├── index.ts                 # Metrics aggregation
│   │   │   ├── registry.ts              # Prometheus registry
│   │   │   ├── http.ts                  # HTTP request metrics
│   │   │   ├── database.ts              # Database query metrics
│   │   │   ├── jobs.ts                  # Job execution metrics
│   │   │   ├── queue.ts                 # Queue operation metrics
│   │   │   ├── outbox.ts                # Outbox operation metrics
│   │   │   ├── worker.ts                # Worker process metrics
│   │   │   └── server.ts                # Server metrics provider
│   │   └── queue/
│   │       ├── queue.factory.ts         # BullMQ queue creation
│   │       ├── queue.producer.ts        # Job enqueuing logic
│   │       └── redis.connection.ts      # Redis connection management
│   │
│   ├── database/                         # Database layer
│   │   ├── client.ts                    # PostgreSQL pool & query execution
│   │   ├── migrate.ts                   # Database migration runner
│   │   ├── types.ts                     # Database type utilities
│   │   └── migrations/
│   │       ├── 001_init.up.sql          # Jobs & job_events tables
│   │       ├── 001_init.down.sql
│   │       ├── 002_create_outbox_events.up.sql    # Outbox table
│   │       ├── 002_create_outbox_events.down.sql
│   │       ├── 003_add_outbox_last_error.up.sql   # Outbox enhancements
│   │       └── 003_add_outbox_last_error.down.sql
│   │
│   ├── repositories/                    # Data access layer
│   │   ├── index.ts
│   │   ├── job.repository.ts            # Job CRUD operations
│   │   ├── job-event.repository.ts      # Job event tracking
│   │   └── outbox.repository.ts         # Outbox event management
│   │
│   ├── services/                        # Business logic
│   │   ├── index.ts
│   │   ├── job.service.ts               # Job creation, status, lifecycle
│   │   └── processor-registry.ts        # Job handler registration & execution
│   │
│   ├── types/
│   │   ├── api.ts                       # API-level TypeScript types
│   │   └── express.d.ts                 # Express type augmentation
│   │
│   └── workers/                         # Background job processing
│       ├── queue.worker.ts              # BullMQ worker process
│       └── outbox.worker.ts             # Outbox polling & enqueue
│
├── Dockerfile                            # Multi-stage Docker build
├── docker-compose.yml                   # Local development containers
├── tsconfig.json                        # TypeScript compiler options
├── tsconfig.node.json                   # TS config for non-src files
├── tsconfig.eslint.json                 # TS config for ESLint
├── tsup.config.ts                       # TypeScript bundler config
├── eslint.config.js                     # ESLint configuration
├── package.json                         # Dependencies & scripts
├── README.md                            # This file
└── LICENSE                              # MIT License
```

---

## 📦 Prerequisites

- **Node.js** 20.0 or higher
- **npm** 10.0 or higher
- **Docker & Docker Compose** (for containerized setup)
- **PostgreSQL** 16 (or use Docker container)
- **Redis** 7 (or use Docker container)

---

## 🚀 Installation

### Option 1: Local Development (with Docker containers)

```bash
# Clone the repository
git clone https://github.com/theSumanth/distributed-task-queue-system.git
cd distributed-task-queue-system

# Install dependencies
npm install

# Create environment file for development
cp .env.example .env.development

# Start PostgreSQL, Redis, and run migrations using Docker Compose
docker-compose up -d

# Run database migrations
npm run migrate:up

# Start API server in development mode
npm run dev

# In separate terminal, start queue worker
npm run build
node dist/workers/queue.worker.cjs

# In another separate terminal, start outbox worker
node dist/workers/outbox.worker.cjs
```

### Option 2: Production with Docker Compose

```bash
# Build and start all services
docker-compose up --build -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f
```

### Option 3: Manual Installation

```bash
# Install dependencies
npm install

# Install PostgreSQL and Redis (macOS)
brew install postgresql redis

# Start PostgreSQL and Redis
brew services start postgresql
brew services start redis

# Configure database connection in .env.production
# Run migrations
npm run migrate:up

# Build project
npm run build

# Start API server
npm start

# Start workers in separate processes
node dist/workers/queue.worker.cjs &
node dist/workers/outbox.worker.cjs &
```

---

## ⚙️ Configuration

Configuration is managed through environment variables using Zod schema validation. All variables are optional with sensible defaults.

### Environment Variables

#### Application (`app.config.ts`)

```env
NODE_ENV=development              # development | staging | production
PORT=8080                        # API server port
API_VERSION=v1                   # API version prefix
```

#### Database (`database.config.ts`)

```env
# Connection string (takes precedence over individual values)
DATABASE_URL=postgresql://user:password@localhost:5432/task_queue

# Or individual components:
DB_HOST=localhost
DB_PORT=5432
DB_NAME=task_queue
DB_USER=postgres
DB_PASSWORD=postgres
DB_SSL_ENABLED=false
```

#### Redis (`redis.config.ts`)

```env
# Connection string (takes precedence)
REDIS_URL=redis://localhost:6379

# Or individual components:
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_TLS_ENABLED=false
```

#### Queue (`queue.config.ts`)

```env
QUEUE_NAME=jobs                           # BullMQ queue name
QUEUE_DEFAULT_CONCURRENCY=5               # Max concurrent job executions
QUEUE_MAX_RETRIES=3                       # Failed job retry attempts (0-20)
QUEUE_BACKOFF_TYPE=exponential            # fixed | exponential
QUEUE_BACKOFF_DELAY_MS=5000               # Initial retry delay (100-60000ms)
QUEUE_REMOVE_ON_COMPLETE=100              # Keep last N completed jobs
QUEUE_REMOVE_ON_FAIL=50                   # Keep last N failed jobs
```

#### Worker (`worker.config.ts`)

```env
WORKER_CONCURRENCY=10                     # Concurrent jobs per worker (default: 10)
WORKER_LOCK_DURATION=30000                # Lock duration for job processing (milliseconds)
WORKER_LOCK_RENEW_TIME=15000              # Renewal interval for locks (milliseconds)
```

#### Outbox (`outbox.config.ts`)

```env
OUTBOX_POLL_INTERVAL_MS=2000              # How often to poll outbox
OUTBOX_BATCH_SIZE=10                      # Jobs to enqueue per poll
OUTBOX_MAX_ATTEMPTS=5                     # Retry attempts for enqueue
OUTBOX_BACKOFF_BASE_MS=2000               # Exponential backoff base
```

#### Security (`security.config.ts`)

```env
CORS_ORIGIN=*                             # CORS allowed origin
RATE_LIMIT_WINDOW_MS=900000               # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100               # Requests per window
METRICS_TOKEN=                            # Bearer token for /metrics (optional)
```

#### Logging (`logging.config.ts`)

```env
LOG_LEVEL=info                            # trace | debug | info | warn | error | fatal
LOG_FORMAT=pretty                         # json | pretty
```

#### Metrics (`metrics.config.ts`)

```env
METRICS_ENABLED=true                      # Enable Prometheus metrics
METRICS_PATH=/metrics                     # Path for metrics endpoint
METRICS_HOST=0.0.0.0                      # Host for metrics server
METRICS_TOKEN=                            # Bearer token for metrics endpoint (optional)
METRICS_COLLECT_INTERVAL_MS=15000         # Metrics collection interval
QUEUE_WORKER_METRICS_PORT=8080            # Queue worker metrics port
OUTBOX_WORKER_METRICS_PORT=8080           # Outbox worker metrics port
```

#### Features (`features.config.ts`)

```env
ENABLE_DEAD_LETTER_QUEUE=true            # Enable DLQ for failed jobs
ENABLE_SCHEDULED_JOBS=true                # Enable scheduled job execution
```

---

## ▶️ Running the Application

### Development Mode

```bash
# Start API server with hot-reload (tsx watch)
npm run dev

# In another terminal: Start queue worker
npm run build
node dist/workers/queue.worker.cjs

# In another terminal: Start outbox worker
node dist/workers/outbox.worker.cjs

# Watch for changes in separate terminals as needed
npm run format:check    # Check formatting
npm run typecheck       # Type check
npm run lint            # Lint code
```

### Production Mode

```bash
# Build TypeScript to CommonJS
npm run build

# Start API server
node dist/index.cjs

# Start queue worker
node dist/workers/queue.worker.cjs

# Start outbox worker
node dist/workers/outbox.worker.cjs
```

### Docker Compose

```bash
# Start all services (PostgreSQL, Redis, API, migrations)
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop all services
docker-compose down

# Stop and remove volumes (reset database)
docker-compose down -v
```

### Health Checks

```bash
# Basic health check
curl http://localhost:8080/health

# Detailed health check (shows database and Redis status)
curl http://localhost:8080/health/detailed
```

---

## 🔌 API Endpoints

### Job Management

#### Create Job

```bash
POST /api/v1/jobs
Content-Type: application/json

{
  "type": "email",                    # email | webhook | generic (required)
  "payload": {                        # Job-specific data (required)
    "to": "user@example.com",
    "subject": "Welcome",
    "body": "Hello!"
  },
  "priority": "high",                 # high | normal | low (optional, default: normal)
  "delayMs": 5000,                    # Delay before execution in ms (optional)
  "runAt": "2026-04-25T10:30:00Z",   # ISO datetime for scheduled execution (optional)
  "cron": "0 9 * * *",                # Cron expression (optional)
  "maxRetries": 3                     # 0-20 (optional, default: 3)
}

Response (201 Created):
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "email",
  "status": "queued",
  "priority": "high",
  "payload": { "to": "user@example.com", ... },
  "result": null,
  "error": null,
  "attempts": 0,
  "maxRetries": 3,
  "delayMs": 5000,
  "runAt": "2026-04-25T10:30:00.000Z",
  "cron": null,
  "createdAt": "2026-04-24T12:00:00.000Z",
  "updatedAt": "2026-04-24T12:00:00.000Z",
  "startedAt": null,
  "completedAt": null,
  "failedAt": null
}
```

#### List Jobs

```bash
GET /api/v1/jobs?status=active&type=email&page=1&limit=20

Response (200 OK):
{
  "jobs": [
    { job record... },
    { job record... }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42
  }
}
```

#### Get Job Details

```bash
GET /api/v1/jobs/:id

Response (200 OK):
{
  "job": { job record... },
  "events": [
    {
      "id": 1,
      "status": "queued",
      "message": "Job queued",
      "details": null,
      "createdAt": "2026-04-24T12:00:00.000Z"
    },
    {
      "id": 2,
      "status": "active",
      "message": "Job execution started",
      "details": { "attempt": 1 },
      "createdAt": "2026-04-24T12:00:05.000Z"
    }
  ]
}
```

#### Cancel Job

```bash
DELETE /api/v1/jobs/:id

Response (200 OK):
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "cancelled",
  ...
}
```

### Health Checks

#### Basic Health

```bash
GET /health

Response (200 OK):
{
  "status": "ok",
  "timestamp": "2026-04-24T12:00:00.000Z"
}
```

#### Detailed Health

```bash
GET /health/detailed

Response (200 OK):
{
  "status": "ok",
  "timestamp": "2026-04-24T12:00:00.000Z",
  "dependencies": {
    "database": "up",
    "redis": "up"
  }
}
```

### Documentation & Monitoring

#### OpenAPI/Swagger UI

```bash
GET /api/v1/docs    # Interactive Swagger UI
GET /api/v1/openapi.json    # OpenAPI spec
```

#### Prometheus Metrics

```bash
GET /metrics        # Prometheus format metrics (requires METRICS_TOKEN header if set)
```

---

## 🗄️ Database Schema

### Connection Pool Configuration

- **Max Connections**: 10
- **Idle Timeout**: 30 seconds
- **Connection Timeout**: 5 seconds

### Jobs Table

```sql
CREATE TABLE jobs (
  id UUID PRIMARY KEY,                    -- Unique job identifier
  queue_job_id TEXT UNIQUE,              -- BullMQ job reference
  type TEXT NOT NULL CHECK (type IN ('email', 'webhook', 'generic')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'active', 'completed', 'failed', 'retrying', 'dead_letter', 'cancelled')),
  priority TEXT NOT NULL CHECK (priority IN ('high', 'normal', 'low')),
  payload JSONB NOT NULL,                 -- Job-specific data
  result JSONB,                          -- Execution result
  error JSONB,                           -- Error details if failed
  attempts INTEGER DEFAULT 0,             -- Current attempt count
  max_retries INTEGER DEFAULT 3,          -- Maximum retry attempts
  delay_ms INTEGER DEFAULT 0,             -- Initial delay in milliseconds
  run_at TIMESTAMPTZ,                    -- Scheduled execution time
  cron TEXT,                             -- Cron expression for recurring jobs
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,                -- When execution started
  completed_at TIMESTAMPTZ,              -- When execution completed
  failed_at TIMESTAMPTZ                  -- When job was marked failed
);

-- Indexes for query performance
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_type ON jobs(type);
CREATE INDEX idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX idx_jobs_run_at ON jobs(run_at);
```

### Job Events Table

```sql
CREATE TABLE job_events (
  id BIGSERIAL PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  status TEXT NOT NULL,                  -- Status at time of event
  message TEXT NOT NULL,                 -- Human-readable message
  details JSONB,                         -- Additional event context
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient querying
CREATE INDEX idx_job_events_job_id ON job_events(job_id);
CREATE INDEX idx_job_events_created_at ON job_events(created_at DESC);
```

### Outbox Events Table (Transactional Pattern)

```sql
CREATE TABLE outbox_events (
  id BIGSERIAL PRIMARY KEY,
  aggregate_id UUID NOT NULL,            -- Job ID
  type TEXT NOT NULL,                    -- Event type (e.g., 'job.enqueue', 'job.dead_letter')
  payload JSONB NOT NULL,                -- Event data
  status TEXT DEFAULT 'pending',         -- pending | processed | failed
  attempts INT DEFAULT 0,                -- Retry count
  last_error TEXT,                       -- Last error message (migration 003)
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP                 -- When processed
);

-- Index for fast polling
CREATE INDEX idx_outbox_status_created_at ON outbox_events(status, created_at);
```

### Job States

```
queued ──► active ──► completed ✓
          (retry) ─────► retrying ──► active
                      (max retries exceeded)
                             ─────────► dead_letter
                             (or)
                             ─────────► failed

cancelled (at any point before active)
```

---

## ⚙️ Job Processing

### Job Lifecycle

1. **Creation (API)**: POST `/api/v1/jobs` creates job record and outbox event
2. **Enqueuing (Outbox Worker)**: Job added to Redis queue based on schedule
3. **Processing (Queue Worker)**: Job execution by appropriate handler
4. **Completion**: Status updated to "completed" with result
5. **Retry/Failure**: On error, retry with exponential backoff or move to DLQ

### Supported Job Types

#### Email Job

```typescript
type: 'email'
payload: {
  to: string,
  subject: string,
  body: string,
  cc?: string,
  bcc?: string
}
```

#### Webhook Job

```typescript
type: 'webhook'
payload: {
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  headers?: Record<string, string>,
  body?: unknown
}
```

#### Generic Job

```typescript
type: 'generic'
payload: {
  // Any structure
  [key: string]: unknown
}
```

### Custom Processors

Implement custom job handlers in `src/services/processor-registry.ts`:

```typescript
const customHandler: ProcessorHandler = async (payload, context) => {
  // Your processing logic
  return {
    success: true,
    data: payload,
  };
};

// Register handler
processorMap['custom-type'] = customHandler;
```

---

## 📊 Monitoring & Metrics

### Prometheus Metrics

All metrics are prefixed with `task_queue_` and include service, environment, and role labels.

#### API Server Metrics (Port 8080/metrics)

- `task_queue_http_requests_total` - Total HTTP requests by method and status
- `task_queue_http_request_duration_seconds` - HTTP request duration histogram
- `task_queue_job_created_total` - Total jobs created by type
- `task_queue_job_state_transition_total` - Job state transitions
- `task_queue_job_execution_duration_seconds` - Job execution time
- Node.js default metrics (memory, CPU, event loop, etc.)

#### Queue Worker Metrics (Port 8080/metrics)

- `task_queue_queue_operation_duration_seconds` - Queue operation timing
- `task_queue_queue_depth` - Jobs waiting by state
- `task_queue_worker_job_duration_seconds` - Worker job execution time
- `task_queue_worker_job_completed_total` - Completed jobs
- `task_queue_worker_job_failed_total` - Failed jobs
- `task_queue_worker_job_stalled_total` - Stalled jobs
- Node.js default metrics

#### Outbox Worker Metrics (Port 8080/metrics)

- `task_queue_outbox_batch_size` - Jobs per batch
- `task_queue_outbox_poll_duration_seconds` - Polling interval timing
- `task_queue_outbox_event_duration_seconds` - Event processing time
- Node.js default metrics

#### Database Metrics

- `task_queue_db_query_duration_seconds` - Query execution timing
- `task_queue_db_transaction_duration_seconds` - Transaction timing
- `task_queue_db_pool_connections` - Active/idle/waiting database connections

#### Low-Cardinality Labels

- Route templates instead of raw URLs
- Known job types/statuses
- Queue states
- Normalized database operation/table names

### Health Endpoints

```bash
# Basic health (always up if server is running)
curl http://localhost:8080/health

# Detailed health (checks PostgreSQL and Redis)
curl http://localhost:8080/health/detailed
```

### Structured Logging

All logs are structured JSON with:

- Timestamp
- Log level (debug, info, warn, error)
- Correlation ID (X-Correlation-ID header)
- Request context (method, URL, status)
- Error details (name, message, stack)

Example output (with `LOG_FORMAT=pretty`):

```
[12:00:00.123] INFO: API server started
    port: 8080
    env: development
[12:00:05.456] DEBUG: POST /api/v1/jobs
    method: POST
    url: /api/v1/jobs
    correlationId: 550e8400-e29b-41d4-a716-446655440000
[12:00:05.789] INFO: Job execution started
    jobId: 550e8400-e29b-41d4-a716-446655440001
    type: email
    attempt: 1
```

---

## 🔨 Development

### Code Quality Tools

```bash
# Format code with Prettier
npm run format

# Check formatting
npm run format:check

# Lint code with ESLint
npm run lint

# Type check with TypeScript
npm run typecheck

# Run all checks
npm run format:check && npm run typecheck && npm run lint
```

### TypeScript Configuration

- **Strict Mode**: All strict type checking enabled
- **NoUnusedLocals/Parameters**: Detect dead code
- **NoImplicitReturns**: Require explicit returns
- **Path Aliases**: `@/*` points to `src/*`

### Testing

_(Framework ready - tests can be added)_

```bash
npm test    # Currently: no tests configured
```

---

## 📜 Scripts

```bash
npm run dev              # Start API with hot-reload
npm run build            # Build TypeScript to CommonJS
npm start                # Run production build
npm run lint             # Run ESLint
npm run format           # Format with Prettier
npm run format:check     # Check format without changes
npm run typecheck        # Type check with TypeScript
npm run migrate:up       # Run pending migrations
npm run migrate:down     # Rollback last migration
npm run db:setup         # Initialize database (migrate up)
npm test                 # Run tests (configure in package.json)
```

---

## 🌍 Environment Files

Create environment files in project root:

```bash
# Development
.env.development
```

Example `.env.development`:

```env
NODE_ENV=development
PORT=8080
API_VERSION=v1

DB_HOST=localhost
DB_PORT=5432
DB_NAME=task_queue
DB_USER=postgres
DB_PASSWORD=postgres

REDIS_HOST=localhost
REDIS_PORT=6379

QUEUE_NAME=jobs
QUEUE_DEFAULT_CONCURRENCY=5
QUEUE_MAX_RETRIES=3

LOG_LEVEL=debug
LOG_FORMAT=pretty

METRICS_ENABLED=true
CORS_ORIGIN=*
```

---

## ❌ Error Handling

### Error Types

#### Bad Request (400)

```json
{
  "code": "BAD_REQUEST",
  "message": "Invalid job type: invalid",
  "statusCode": 400,
  "details": {
    "field": "type",
    "reason": "Invalid enum value"
  }
}
```

#### Not Found (404)

```json
{
  "code": "NOT_FOUND",
  "message": "Job 550e8400-e29b-41d4-a716-446655440000 not found",
  "statusCode": 404
}
```

#### Conflict (409)

```json
{
  "code": "CONFLICT",
  "message": "Job already exists",
  "statusCode": 409
}
```

#### Internal Error (500)

```json
{
  "code": "INTERNAL_ERROR",
  "message": "Database connection failed",
  "statusCode": 500
}
```

### Error Recovery

- **Database errors**: Connection pooling with automatic retry
- **Redis errors**: Connection timeout handling
- **Job processing errors**: Automatic retry with exponential backoff
- **Outbox processing errors**: Persistent retry with backoff

---

## 🏛️ Architecture Patterns

### Transactional Outbox Pattern

### Transactional Outbox Pattern

Ensures **at-least-once delivery** of jobs:

1. Client sends job creation request
2. API creates job record + outbox event in **single transaction**
3. Response sent immediately
4. Outbox worker polls table periodically
5. Outbox event → job enqueued to Redis
6. Outbox event marked as processed
7. If worker crashes before step 6, polling resumes from pending events

> ⚠️ Note: This guarantees at-least-once delivery. Consumers should be idempotent to safely handle duplicate job execution.

### Saga Pattern (Implicit)

Multi-step job processing with compensation:

- Job creation triggers outbox event
- Outbox worker enqueues to Redis
- Queue worker processes and updates status
- Failure triggers retry logic

### CQRS-like Separation

- **Commands**: POST /jobs creates jobs
- **Queries**: GET /jobs lists/queries jobs
- **Events**: Job events table maintains audit trail

### Dependency Injection

Services injected with dependencies:

```typescript
// Constructor injection
constructor(
  jobRepository: JobRepository,
  eventRepository: JobEventRepository,
  outboxRepository: OutboxRepository
)
```

### Repository Pattern

Data access abstracted from business logic:

- `JobRepository` - CRUD for jobs
- `JobEventRepository` - CRUD for events
- `OutboxRepository` - CRUD for outbox

---

## 📝 Contributing

When contributing:

1. Follow TypeScript strict mode
2. Use Prettier formatting
3. Run ESLint checks
4. Add type annotations
5. Update documentation

---

## 📄 License

This project is licensed under the **MIT License** - see [LICENSE](LICENSE) file for details.

---

## 🤝 Support

For issues and questions:

- **GitHub Issues**: [Create an issue](https://github.com/theSumanth/distributed-task-queue-system/issues)
- **GitHub Discussions**: [Start a discussion](https://github.com/theSumanth/distributed-task-queue-system/discussions)

---

## 🔗 References

- [BullMQ Documentation](https://docs.bullmq.io/)
- [Express.js Guide](https://expressjs.com/)
- [Zod Validation](https://zod.dev/)
- [Prometheus Metrics](https://prometheus.io/docs/concepts/data_model/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/documentation)
- [Transactional Outbox Pattern](https://microservices.io/patterns/data/transactional-outbox.html)

---

**Last Updated**: April 24, 2026  
**Maintained by**: Sumanth Bojugu
