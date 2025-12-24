# Rust ERP 系统开发环境搭建指南

## 1. 环境要求

### 1.1 硬件要求

| 配置项 | 最低要求 | 推荐配置 |
|-------|---------|---------|
| CPU | 4核 | 8核及以上 |
| 内存 | 8GB | 16GB及以上 |
| 硬盘 | 50GB 可用空间 | 100GB SSD |
| 操作系统 | macOS 12+, Ubuntu 20.04+, Windows 11 | macOS 13+, Ubuntu 22.04+ |

### 1.2 软件依赖

| 软件 | 版本要求 | 用途 |
|-----|---------|------|
| Rust | 1.75+ (Edition 2021) | 主要编程语言 |
| PostgreSQL | 16+ | 主数据库 |
| Redis | 7+ | 缓存 |
| ClickHouse | 23.8+ | 分析服务数据仓库 |
| Docker | 24+ | 容器化 |
| Docker Compose | 2.20+ | 本地服务编排 |
| Kafka | 3.6+ | 消息队列 |
| Git | 2.40+ | 版本控制 |
| Node.js | 20+ (可选) | 前端开发 |

---

## 2. 开发工具安装

### 2.1 安装 Rust

#### macOS / Linux

```bash
# 安装 rustup（Rust 工具链管理器）
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 配置环境变量
source $HOME/.cargo/env

# 验证安装
rustc --version
cargo --version

# 安装 Rust Edition 2021
rustup default stable
```

#### Windows

```powershell
# 下载并运行 rustup-init.exe
# https://rustup.rs/

# 验证安装
rustc --version
cargo --version
```

### 2.2 安装必要的 Rust 工具

```bash
# 代码格式化工具
rustup component add rustfmt

# 静态分析工具（Linter）
rustup component add clippy

# LLVM 覆盖率工具
rustup component add llvm-tools-preview

# 安装 cargo-watch（自动重新编译）
cargo install cargo-watch

# 安装 cargo-tarpaulin（代码覆盖率）
cargo install cargo-tarpaulin

# 安装 sqlx-cli（数据库迁移工具）
cargo install sqlx-cli --features postgres

# 安装 cargo-expand（宏展开查看工具）
cargo install cargo-expand

# 安装 cargo-audit（依赖安全审计）
cargo install cargo-audit
```

---

## 3. 数据库环境搭建

### 3.1 使用 Docker Compose 快速启动

项目仓库已经在 `docker/docker-compose.dev.yml` 中预置了开发环境依赖（数据库、缓存、消息队列、监控等），下面截取关键内容，并补充新增的 ClickHouse 服务配置：

```yaml
version: '3.9'

services:
  # PostgreSQL 数据库
  postgres:
    image: postgres:16-alpine
    container_name: erp-postgres
    environment:
      POSTGRES_USER: erp_user
      POSTGRES_PASSWORD: erp_password_dev
      POSTGRES_DB: erp_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./infrastructure/postgres/init:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U erp_user -d erp_dev"]
      interval: 10s
      timeout: 5s
      retries: 5

  # PostgreSQL 管理工具
  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: erp-pgadmin
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@erp.local
      PGADMIN_DEFAULT_PASSWORD: admin
    ports:
      - "5050:80"
    depends_on:
      - postgres

  # ClickHouse 数据仓库
  clickhouse:
    image: clickhouse/clickhouse-server:23.8
    container_name: erp-clickhouse
    environment:
      CLICKHOUSE_DB: analytics
      CLICKHOUSE_USER: analytics_user
      CLICKHOUSE_PASSWORD: analytics_pass
      CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT: "1"
    ports:
      - "8123:8123"   # HTTP 接口
      - "9000:9000"   # Native TCP 接口
    volumes:
      - clickhouse_data:/var/lib/clickhouse
      - ./infrastructure/clickhouse/config.d:/etc/clickhouse-server/config.d
      - ./infrastructure/clickhouse/users.d:/etc/clickhouse-server/users.d
    ulimits:
      nofile:
        soft: 262144
        hard: 262144

  # Redis 缓存
  redis:
    image: redis:7-alpine
    container_name: erp-redis
    command: redis-server --appendonly yes --requirepass redis_dev_password
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis 管理工具
  redis-commander:
    image: rediscommander/redis-commander:latest
    container_name: erp-redis-commander
    environment:
      REDIS_HOSTS: local:redis:6379:0:redis_dev_password
    ports:
      - "8081:8081"
    depends_on:
      - redis

  # Kafka 和 Zookeeper
  zookeeper:
    image: confluentinc/cp-zookeeper:7.5.0
    container_name: erp-zookeeper
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
    ports:
      - "2181:2181"
    volumes:
      - zookeeper_data:/var/lib/zookeeper/data
      - zookeeper_log:/var/lib/zookeeper/log

  kafka:
    image: confluentinc/cp-kafka:7.5.0
    container_name: erp-kafka
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
      - "9093:9093"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092,PLAINTEXT_INTERNAL://kafka:9093
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,PLAINTEXT_INTERNAL:PLAINTEXT
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
    volumes:
      - kafka_data:/var/lib/kafka/data
    healthcheck:
      test: ["CMD", "kafka-topics", "--bootstrap-server", "localhost:9092", "--list"]
      interval: 30s
      timeout: 10s
      retries: 5

  # Kafka UI
  kafka-ui:
    image: provectuslabs/kafka-ui:latest
    container_name: erp-kafka-ui
    depends_on:
      - kafka
    ports:
      - "8080:8080"
    environment:
      KAFKA_CLUSTERS_0_NAME: local
      KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS: kafka:9093

  # Jaeger 链路追踪
  jaeger:
    image: jaegertracing/all-in-one:1.51
    container_name: erp-jaeger
    ports:
      - "6831:6831/udp"  # Jaeger agent
      - "16686:16686"    # Jaeger UI
      - "14268:14268"    # Jaeger collector
    environment:
      COLLECTOR_ZIPKIN_HOST_PORT: 9411

  # Prometheus 监控
  prometheus:
    image: prom/prometheus:v2.48.0
    container_name: erp-prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./config/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'

  # Grafana 可视化
  grafana:
    image: grafana/grafana:10.2.2
    container_name: erp-grafana
    ports:
      - "3000:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin
      GF_SECURITY_ADMIN_USER: admin
    volumes:
      - grafana_data:/var/lib/grafana
      - ./config/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./config/grafana/datasources:/etc/grafana/provisioning/datasources
    depends_on:
      - prometheus

volumes:
  postgres_data:
  redis_data:
  kafka_data:
  zookeeper_data:
  zookeeper_log:
  prometheus_data:
  grafana_data:
  clickhouse_data:
```

为 ClickHouse 创建配置目录并定义默认用户：

```bash
mkdir -p infrastructure/clickhouse/{config.d,users.d}
cat > infrastructure/clickhouse/users.d/analytics-user.xml <<'EOF'
<?xml version="1.0"?>
<yandex>
  <users>
    <analytics_user>
      <password>analytics_pass</password>
      <profile>default</profile>
      <quota>default</quota>
      <networks>
        <ip>::/0</ip>
      </networks>
      <access_management>1</access_management>
      <databases>
        <analytics>
          <permissions>ALL</permissions>
        </analytics>
      </databases>
    </analytics_user>
  </users>
</yandex>
EOF
```

> ⚠️ **安全提示**：示例中使用明文密码便于本地调试，生产环境请改为 `password_sha256_hex` 并限制可信网段。

**启动所有服务**：

```bash
# 启动所有服务
docker compose -f docker/docker-compose.dev.yml up -d

# 查看服务状态
docker compose -f docker/docker-compose.dev.yml ps

# 查看日志
docker compose -f docker/docker-compose.dev.yml logs -f

# 停止所有服务
docker compose -f docker/docker-compose.dev.yml down

# 停止并删除数据
docker compose -f docker/docker-compose.dev.yml down -v
```

---

### 3.2 数据库初始化脚本

在 `infrastructure/postgres/init/01-init.sql` 中定义基础数据库：

```sql
-- 创建多个数据库实例（每个微服务一个数据库）
CREATE DATABASE financial_db;
CREATE DATABASE sales_db;
CREATE DATABASE materials_db;
CREATE DATABASE hr_db;
CREATE DATABASE controlling_db;
CREATE DATABASE production_db;

-- 创建用户并授权
CREATE USER financial_user WITH PASSWORD 'financial_pass';
CREATE USER sales_user WITH PASSWORD 'sales_pass';
CREATE USER materials_user WITH PASSWORD 'materials_pass';

GRANT ALL PRIVILEGES ON DATABASE financial_db TO financial_user;
GRANT ALL PRIVILEGES ON DATABASE sales_db TO sales_user;
GRANT ALL PRIVILEGES ON DATABASE materials_db TO materials_user;

-- 切换到 financial_db 创建扩展
\c financial_db;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\c sales_db;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\c materials_db;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

---

### 3.3 手动安装 PostgreSQL（可选）

#### macOS

```bash
# 使用 Homebrew 安装
brew install postgresql@16

# 启动服务
brew services start postgresql@16

# 创建数据库
createdb erp_dev

# 连接数据库
psql erp_dev
```

#### Ubuntu

```bash
# 添加官方源
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -

# 安装
sudo apt-get update
sudo apt-get install postgresql-16

# 启动服务
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 切换到 postgres 用户
sudo -u postgres psql

# 创建用户和数据库
CREATE USER erp_user WITH PASSWORD 'erp_password';
CREATE DATABASE erp_dev OWNER erp_user;
```

---

## 4. 项目代码结构初始化

### 4.1 克隆项目（假设项目已初始化）

```bash
# 克隆代码仓库
git clone https://github.com/your-org/rust-erp-system.git
cd rust-erp-system

# 查看目录结构
tree -L 3
```

### 4.2 创建新项目（从零开始）

使用以下脚本可以快速搭建与《Rust-ERP系统项目目录结构.md》一致的骨架：

```bash
# 创建项目根目录
mkdir erp-system
cd erp-system

# 初始化 Cargo Workspace
cat > Cargo.toml <<'EOF'
[workspace]
resolver = "2"

members = [
    # 共享库
    "shared/domain-primitives",
    "shared/event-sourcing",
    "shared/cqrs",
    "shared/observability",
    "shared/messaging",
    "shared/auth",
    "shared/api-contracts",

    # 微服务
    "services/financial-service",
    "services/controlling-service",
    "services/materials-service",
    "services/sales-service",
    "services/production-service",
    "services/hr-service",
    "services/quality-service",
    "services/maintenance-service",
    "services/crm-service",
    "services/project-service",
    "services/scm-service",
    "services/treasury-service",
    "services/warehouse-service",
    "services/shipping-service",
    "services/analytics-service",
    "services/api-gateway",

    # 开发工具
    "tools/cli",
    "tools/migration-tool",
    "tools/load-testing"
]

[workspace.package]
version = "0.1.0"
edition = "2021"
authors = ["ERP Team <team@erp.example.com>"]
license = "MIT"

[workspace.dependencies]
axum = "0.7"
tokio = { version = "1.35", features = ["full"] }
tower = "0.4"
tower-http = { version = "0.5", features = ["trace", "cors"] }
sqlx = { version = "0.7", features = ["runtime-tokio-rustls", "postgres", "uuid", "chrono", "json"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
thiserror = "1.0"
anyhow = "1.0"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
uuid = { version = "1.6", features = ["v4", "serde"] }
chrono = { version = "0.4", features = ["serde"] }
validator = { version = "0.16", features = ["derive"] }
dotenvy = "0.15"
rdkafka = { version = "0.36", features = ["cmake-build"] }
redis = { version = "0.24", features = ["tokio-comp", "connection-manager"] }
tonic = "0.11"
prost = "0.12"
mockall = "0.12"
EOF

# 创建共享库骨架
for lib in domain-primitives event-sourcing cqrs observability messaging auth api-contracts; do
  mkdir -p shared/$lib/src
  touch shared/$lib/{Cargo.toml,src/lib.rs}
done

# 创建微服务骨架（DDD 分层 + 迁移 + 测试目录）
services=(financial-service controlling-service materials-service sales-service production-service hr-service quality-service maintenance-service crm-service project-service scm-service treasury-service warehouse-service shipping-service analytics-service api-gateway)
for svc in "${services[@]}"; do
  mkdir -p services/$svc/src/{api/{rest/{handlers,dto},grpc},application/{commands,queries,services},domain/{aggregates,value_objects,events,services,repositories},infrastructure/{persistence/{postgres,redis},messaging,config}}
  mkdir -p services/$svc/{migrations,tests/{integration,unit}}
  touch services/$svc/Cargo.toml
  touch services/$svc/src/main.rs
done

# 创建资源目录
mkdir -p proto/{common,financial,controlling,materials,sales,production,hr,quality,maintenance,crm,project,scm,treasury,warehouse,shipping,analytics}/v1
mkdir -p docker && touch docker/{Dockerfile.service,docker-compose.yml,docker-compose.dev.yml,docker-compose.prod.yml}
mkdir -p k8s/{base,overlays/{dev,staging,production},helm/erp-system/templates}
mkdir -p infrastructure/{kafka,postgres/init,redis,monitoring/{prometheus,grafana/{dashboards,datasources},loki,jaeger},clickhouse/{config.d,users.d},scripts}
mkdir -p docs/{architecture,deployment,development}
mkdir -p tools/{cli/src,migration-tool/src,load-testing/scenarios}
```

---

### 4.3 创建财务服务 Cargo.toml

创建 `services/financial-service/Cargo.toml`：

```toml
[package]
name = "financial-service"
version.workspace = true
edition.workspace = true
authors.workspace = true

[dependencies]
# Workspace 共享依赖
axum.workspace = true
tokio.workspace = true
tower.workspace = true
tower-http.workspace = true
sqlx.workspace = true
serde.workspace = true
serde_json.workspace = true
thiserror.workspace = true
anyhow.workspace = true
tracing.workspace = true
tracing-subscriber.workspace = true
uuid.workspace = true
chrono.workspace = true
validator.workspace = true
dotenvy.workspace = true
rdkafka.workspace = true
redis.workspace = true
tonic.workspace = true
prost.workspace = true

# 内部依赖（共享库）
domain-primitives = { path = "../../shared/domain-primitives" }
event-sourcing = { path = "../../shared/event-sourcing" }
cqrs = { path = "../../shared/cqrs" }
auth = { path = "../../shared/auth" }
observability = { path = "../../shared/observability" }
messaging = { path = "../../shared/messaging" }
api-contracts = { path = "../../shared/api-contracts" }

# 其他依赖
async-trait = "0.1"
futures = "0.3"

[dev-dependencies]
mockall.workspace = true
tokio-test = "0.4"
testcontainers = "0.15"

[[bin]]
name = "financial-service"
path = "src/main.rs"
```

---

### 4.4 创建环境配置文件

创建 `.env.example`：

```bash
# 应用配置
APP_NAME=financial-service
APP_ENV=development
APP_HOST=0.0.0.0
APP_PORT=8000
LOG_LEVEL=debug

# 数据库配置
DATABASE_URL=postgres://financial_user:financial_pass@localhost:5432/financial_db
DATABASE_MAX_CONNECTIONS=10
DATABASE_MIN_CONNECTIONS=2

# Redis 配置
REDIS_URL=redis://:redis_dev_password@localhost:6379/0
REDIS_MAX_CONNECTIONS=10

# Kafka 配置
KAFKA_BROKERS=localhost:9092
KAFKA_GROUP_ID=financial-service-group
KAFKA_TOPIC_TRANSACTION_POSTED=financial.transaction.posted
KAFKA_TOPIC_ACCOUNT_CREATED=financial.account.created

# JWT 配置
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRATION_HOURS=1

# OpenTelemetry 配置
OTEL_EXPORTER_JAEGER_ENDPOINT=http://localhost:14268/api/traces
OTEL_SERVICE_NAME=financial-service

# Prometheus 配置
PROMETHEUS_METRICS_PORT=9091
```

**复制为实际配置**：

```bash
cp .env.example .env
```

---

## 5. 运行数据库迁移

### 5.1 使用 SQLx 创建迁移

```bash
# 进入财务服务目录
cd services/financial-service

# 设置数据库 URL 环境变量
export DATABASE_URL="postgres://financial_user:financial_pass@localhost:5432/financial_db"

# 创建迁移脚本
sqlx migrate add init_financial_db

# 编辑迁移文件（自动创建在 migrations/ 目录）
# 文件名类似：migrations/20251221000000_init_financial_db.sql
```

编辑 `migrations/20251221000000_init_financial_db.sql`：

```sql
-- 创建 accounts 表
CREATE TABLE accounts (
    account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_number VARCHAR(20) NOT NULL UNIQUE,
    account_name VARCHAR(200) NOT NULL,
    account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
    currency VARCHAR(3) NOT NULL DEFAULT 'CNY',
    balance_type VARCHAR(10) NOT NULL CHECK (balance_type IN ('DEBIT', 'CREDIT')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    updated_at TIMESTAMP,
    updated_by UUID,
    version INTEGER NOT NULL DEFAULT 1,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_accounts_number ON accounts(account_number) WHERE is_deleted = FALSE;
CREATE INDEX idx_accounts_type ON accounts(account_type) WHERE is_deleted = FALSE;

-- 创建 transactions 表
CREATE TABLE transactions (
    transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_number VARCHAR(50) NOT NULL UNIQUE,
    document_type VARCHAR(10) NOT NULL,
    document_date DATE NOT NULL,
    posting_date DATE NOT NULL,
    fiscal_year INTEGER NOT NULL,
    fiscal_period INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'POSTED', 'REVERSED')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    posted_at TIMESTAMP,
    posted_by UUID,
    version INTEGER NOT NULL DEFAULT 1,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_transactions_number ON transactions(document_number);
CREATE INDEX idx_transactions_posting_date ON transactions(posting_date DESC);

-- 创建 journal_entries 表
CREATE TABLE journal_entries (
    entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(transaction_id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(account_id),
    line_number INTEGER NOT NULL,
    debit_amount DECIMAL(19,2) NOT NULL DEFAULT 0.00,
    credit_amount DECIMAL(19,2) NOT NULL DEFAULT 0.00,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT uk_entries_transaction_line UNIQUE (transaction_id, line_number),
    CONSTRAINT ck_entries_amounts CHECK (
        (debit_amount >= 0 AND credit_amount >= 0) AND
        (debit_amount = 0 OR credit_amount = 0)
    )
);

CREATE INDEX idx_entries_transaction ON journal_entries(transaction_id);
CREATE INDEX idx_entries_account ON journal_entries(account_id);

-- 插入初始科目数据
INSERT INTO accounts (account_number, account_name, account_type, balance_type, currency, created_by)
VALUES
    ('1001', '现金', 'ASSET', 'DEBIT', 'CNY', '00000000-0000-0000-0000-000000000001'),
    ('1002', '银行存款', 'ASSET', 'DEBIT', 'CNY', '00000000-0000-0000-0000-000000000001'),
    ('2001', '应付账款', 'LIABILITY', 'CREDIT', 'CNY', '00000000-0000-0000-0000-000000000001'),
    ('4001', '主营业务收入', 'REVENUE', 'CREDIT', 'CNY', '00000000-0000-0000-0000-000000000001'),
    ('5001', '主营业务成本', 'EXPENSE', 'DEBIT', 'CNY', '00000000-0000-0000-0000-000000000001');
```

**运行迁移**：

```bash
# 执行迁移
sqlx migrate run

# 查看迁移历史
sqlx migrate info

# 回滚最后一次迁移
sqlx migrate revert
```

---

## 6. 代码示例：Hello World 服务

创建 `services/financial-service/src/main.rs`：

```rust
use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use sqlx::postgres::PgPoolOptions;
use std::net::SocketAddr;
use tracing::info;
use uuid::Uuid;

#[derive(Clone)]
struct AppState {
    db: sqlx::PgPool,
}

#[derive(Serialize)]
struct HealthResponse {
    status: String,
    version: String,
}

#[derive(Serialize)]
struct Account {
    account_id: Uuid,
    account_number: String,
    account_name: String,
    account_type: String,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // 初始化日志
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    // 加载环境变量
    dotenvy::dotenv().ok();

    // 数据库连接
    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set");

    let db_pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await?;

    info!("Connected to database");

    // 应用状态
    let state = AppState { db: db_pool };

    // 路由
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/v1/accounts", get(list_accounts))
        .with_state(state);

    // 启动服务器
    let addr = SocketAddr::from(([0, 0, 0, 0], 8000));
    info!("Starting server on {}", addr);

    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await?;

    Ok(())
}

// 健康检查接口
async fn health_check() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

// 查询科目列表
async fn list_accounts(
    State(state): State<AppState>,
) -> Result<Json<Vec<Account>>, StatusCode> {
    let accounts = sqlx::query_as!(
        Account,
        r#"
        SELECT account_id, account_number, account_name, account_type
        FROM accounts
        WHERE is_deleted = FALSE
        ORDER BY account_number
        LIMIT 10
        "#
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(accounts))
}
```

---

## 7. 编译和运行

### 7.1 编译项目

```bash
# 回到项目根目录
cd /path/to/erp-system

# 检查代码格式
cargo fmt --all -- --check

# 运行 Clippy 静态分析
cargo clippy --all-targets --all-features -- -D warnings

# 构建项目（debug 模式）
cargo build

# 构建项目（release 模式）
cargo build --release

# 运行测试
cargo test --all

# 查看依赖树
cargo tree
```

### 7.2 运行服务

```bash
# 运行财务服务
cd services/financial-service
cargo run

# 或者使用 cargo-watch 自动重新编译
cargo watch -x run

# 测试健康检查接口
curl http://localhost:8000/health

# 测试查询科目接口
curl http://localhost:8000/api/v1/accounts
```

**预期输出**：

```json
{
  "status": "ok",
  "version": "0.1.0"
}
```

---

## 8. 开发工具推荐

### 8.1 IDE/编辑器

#### VS Code（推荐）

**必装扩展**：

```json
{
  "recommendations": [
    "rust-lang.rust-analyzer",      // Rust 语言支持
    "serayuzgur.crates",             // Cargo.toml 依赖管理
    "tamasfe.even-better-toml",      // TOML 语法高亮
    "vadimcn.vscode-lldb",           // 调试器
    "ms-azuretools.vscode-docker",   // Docker 支持
    "mtxr.sqltools",                 // SQL 工具
    "mtxr.sqltools-driver-pg"        // PostgreSQL 驱动
  ]
}
```

**配置文件** (`.vscode/settings.json`):

```json
{
  "rust-analyzer.checkOnSave.command": "clippy",
  "rust-analyzer.cargo.features": "all",
  "editor.formatOnSave": true,
  "[rust]": {
    "editor.defaultFormatter": "rust-lang.rust-analyzer"
  },
  "files.watcherExclude": {
    "**/target/**": true
  }
}
```

#### IntelliJ IDEA / CLion

安装 Rust 插件（IntelliJ Rust）

---

### 8.2 调试配置

创建 `.vscode/launch.json`：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "lldb",
      "request": "launch",
      "name": "Debug Financial Service",
      "cargo": {
        "args": [
          "build",
          "--bin=financial-service",
          "--package=financial-service"
        ],
        "filter": {
          "name": "financial-service",
          "kind": "bin"
        }
      },
      "args": [],
      "cwd": "${workspaceFolder}/services/financial-service",
      "env": {
        "DATABASE_URL": "postgres://financial_user:financial_pass@localhost:5432/financial_db",
        "RUST_LOG": "debug"
      }
    }
  ]
}
```

---

### 8.3 数据库管理工具

1. **pgAdmin**（已包含在 `docker/docker-compose.dev.yml`）
   - 访问：http://localhost:5050
   - 用户名：admin@erp.local
   - 密码：admin

2. **DBeaver**（推荐）
   ```bash
   # macOS
   brew install --cask dbeaver-community

   # Ubuntu
   sudo snap install dbeaver-ce
   ```

3. **psql 命令行**
   ```bash
   # 连接数据库
   psql -h localhost -U financial_user -d financial_db

   # 查看表结构
   \d accounts

   # 查询数据
   SELECT * FROM accounts;
   ```

---

## 9. 常见问题排查

### 9.1 数据库连接失败

**错误信息**：
```
Error: error connecting to server: Connection refused
```

**解决方案**：
```bash
# 检查 PostgreSQL 是否运行
docker ps | grep postgres

# 查看日志
docker compose -f docker/docker-compose.dev.yml logs postgres

# 重启 PostgreSQL
docker compose -f docker/docker-compose.dev.yml restart postgres
```

---

### 9.2 Rust 编译错误

**错误信息**：
```
error: linking with `cc` failed: exit status: 1
```

**解决方案**（macOS）：
```bash
# 安装 Xcode Command Line Tools
xcode-select --install

# 安装 CMake（Kafka 依赖需要）
brew install cmake
```

**解决方案**（Ubuntu）：
```bash
# 安装构建工具
sudo apt-get install build-essential cmake libssl-dev pkg-config
```

---

### 9.3 SQLx 编译时检查失败

**错误信息**：
```
error: error occurred while running `sqlx-data.json`
```

**解决方案**：
```bash
# 方案1：离线模式（不检查 SQL）
export SQLX_OFFLINE=true
cargo build

# 方案2：生成 sqlx-data.json
cargo sqlx prepare -- --lib

# 方案3：运行迁移后再编译
sqlx migrate run
cargo build
```

---

## 10. 开发流程最佳实践

### 10.1 Git 工作流

```bash
# 1. 创建功能分支
git checkout -b feature/add-account-api

# 2. 开发过程中频繁提交
git add .
git commit -m "feat: 添加创建科目 API"

# 3. 提交前检查
cargo fmt --all
cargo clippy --all-targets
cargo test --all

# 4. 推送到远程
git push origin feature/add-account-api

# 5. 创建 Pull Request
```

---

### 10.2 代码审查检查项

- [ ] 代码通过 `cargo fmt` 格式化
- [ ] 代码通过 `cargo clippy` 静态检查（无警告）
- [ ] 所有测试通过 `cargo test`
- [ ] 新增代码有单元测试（覆盖率 > 70%）
- [ ] 领域层测试覆盖率 100%
- [ ] API 接口有集成测试
- [ ] 敏感配置使用环境变量
- [ ] 错误处理完善（避免 `unwrap()`）
- [ ] 文档注释完整

---

### 10.3 测试策略

```bash
# 运行所有测试
cargo test --all

# 运行单个服务测试
cargo test --package financial-service

# 运行单个模块测试
cargo test --package financial-service domain::aggregates::account

# 生成测试覆盖率报告
cargo tarpaulin --out Html --output-dir coverage

# 查看覆盖率报告
open coverage/index.html
```

---

## 11. 性能调优

### 11.1 编译优化配置

在 `Cargo.toml` 中添加：

```toml
[profile.dev]
opt-level = 0          # 开发模式不优化（编译快）

[profile.release]
opt-level = 3          # 生产模式最高优化
lto = true             # 启用链接时优化
codegen-units = 1      # 单个代码生成单元（更好的优化）
strip = true           # 移除调试符号（减小二进制大小）
```

### 11.2 数据库连接池调优

```rust
let db_pool = PgPoolOptions::new()
    .max_connections(20)           // 最大连接数
    .min_connections(5)            // 最小连接数
    .acquire_timeout(Duration::from_secs(30))  // 获取连接超时
    .idle_timeout(Duration::from_secs(600))    // 空闲连接超时
    .max_lifetime(Duration::from_secs(1800))   // 连接最大生命周期
    .connect(&database_url)
    .await?;
```

---

## 12. 下一步

完成环境搭建后，可以进行以下步骤：

1. ✅ 运行 `cargo build` 验证环境
2. ✅ 运行数据库迁移 `sqlx migrate run`
3. ✅ 启动服务 `cargo run`
4. ✅ 测试健康检查接口 `curl http://localhost:8000/health`
5. ⏳ 阅读《API 设计文档》了解接口规范
6. ⏳ 阅读《数据库设计文档》了解数据模型
7. ⏳ 开始实现第一个功能模块（创建会计科目 API）

---

## 附录：快速启动脚本

创建 `infrastructure/scripts/dev-setup.sh`：

```bash
#!/bin/bash
set -e

echo "🚀 Starting ERP Development Environment Setup"

# 1. 检查依赖
echo "📦 Checking dependencies..."
command -v docker >/dev/null 2>&1 || { echo "❌ Docker not found"; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "❌ Docker Compose plugin not found"; exit 1; }
command -v cargo >/dev/null 2>&1 || { echo "❌ Rust not found"; exit 1; }

# 2. 启动 Docker 服务
echo "🐳 Starting Docker services..."
docker compose -f docker/docker-compose.dev.yml up -d

# 3. 等待数据库就绪
echo "⏳ Waiting for PostgreSQL..."
until docker exec erp-postgres pg_isready -U erp_user -d erp_dev; do
  sleep 2
done

# 4. 运行数据库迁移
echo "📊 Running database migrations..."
cd services/financial-service
export DATABASE_URL="postgres://financial_user:financial_pass@localhost:5432/financial_db"
sqlx migrate run
cd ../..

# 5. 编译项目
echo "🔨 Building project..."
cargo build

echo "✅ Setup complete!"
echo ""
echo "📝 Quick Start:"
echo "  - Start financial service:  cd services/financial-service && cargo run"
echo "  - pgAdmin:                  http://localhost:5050"
echo "  - Kafka UI:                 http://localhost:8080"
echo "  - Jaeger:                   http://localhost:16686"
echo "  - Grafana:                  http://localhost:3000"
```

**使用方法**：

```bash
chmod +x infrastructure/scripts/dev-setup.sh
./infrastructure/scripts/dev-setup.sh
```

---

**文档版本**: v1.1
**最后更新**: 2025-12-23
**维护者**: ERP 开发团队
