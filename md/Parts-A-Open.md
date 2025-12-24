# 附录A - 开发环境搭建详细指南

**文档版本**: v1.0
**适用人员**: 全体开发人员（新人必读）
**预计搭建时间**: 4-8 小时
**最后更新**: 2025-12-21

---

## 目录

1. [硬件要求](#一硬件要求)
2. [操作系统准备](#二操作系统准备)
3. [基础工具安装](#三基础工具安装)
4. [Rust 开发环境](#四rust-开发环境)
5. [IDE 配置](#五ide-配置)
6. [数据库环境](#六数据库环境)
7. [消息队列环境](#七消息队列环境)
8. [容器环境](#八容器环境)
9. [项目代码获取](#九项目代码获取)
10. [环境验证](#十环境验证)
11. [常见问题](#十一常见问题)

---

## 一、硬件要求

### 最低配置
- **CPU**: 4核（Intel i5 或 AMD Ryzen 5）
- **内存**: 16GB RAM
- **硬盘**: 256GB SSD（至少50GB可用空间）
- **网络**: 稳定的互联网连接

### 推荐配置
- **CPU**: 8核或以上（Intel i7/i9 或 AMD Ryzen 7/9）
- **内存**: 32GB RAM
- **硬盘**: 512GB SSD 或更大
- **网络**: 100Mbps 或更快

### 为什么需要这些配置？
- **内存**: Rust 编译器内存占用较大，并行编译需要更多内存
- **CPU**: 多核可加速 Cargo 并行编译
- **SSD**: 加快依赖下载和编译速度
- **网络**: 下载 Rust 依赖、Docker 镜像需要良好网络

---

## 二、操作系统准备

### macOS（推荐）

**支持版本**: macOS 12 (Monterey) 或更高

**前置准备**:
```bash
# 1. 安装 Xcode Command Line Tools
xcode-select --install

# 2. 安装 Homebrew（包管理器）
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 3. 验证 Homebrew 安装
brew --version
```

### Linux（Ubuntu/Debian）

**支持版本**: Ubuntu 22.04 LTS 或更高

**前置准备**:
```bash
# 1. 更新系统
sudo apt update && sudo apt upgrade -y

# 2. 安装基础工具
sudo apt install -y build-essential curl wget git \
    pkg-config libssl-dev protobuf-compiler

# 3. 验证 GCC 版本（需要 GCC 9+）
gcc --version
```

### Windows（使用 WSL2）

**不推荐直接在 Windows 上开发**，建议使用 WSL2 (Windows Subsystem for Linux)

**WSL2 安装步骤**:
```powershell
# 1. 以管理员身份打开 PowerShell

# 2. 启用 WSL
wsl --install

# 3. 重启计算机

# 4. 安装 Ubuntu 22.04
wsl --install -d Ubuntu-22.04

# 5. 进入 WSL，设置用户名和密码
wsl

# 6. 在 WSL 内按照 Linux 步骤继续
```

---

## 三、基础工具安装

### Git（版本控制）

**macOS**:
```bash
brew install git
git --version  # 应该是 2.30+
```

**Linux**:
```bash
sudo apt install git
git --version
```

**Git 配置**:
```bash
# 配置用户信息
git config --global user.name "你的姓名"
git config --global user.email "your.email@example.com"

# 配置默认分支名
git config --global init.defaultBranch main

# 配置自动换行（macOS/Linux）
git config --global core.autocrlf input

# 配置 SSH Key（用于 GitHub）
ssh-keygen -t ed25519 -C "your.email@example.com"
# 按提示操作，默认路径即可，可设置密码或留空

# 添加 SSH Key 到 ssh-agent
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519

# 查看公钥并复制到 GitHub
cat ~/.ssh/id_ed25519.pub
# 访问 https://github.com/settings/keys 添加 SSH Key
```

### Protobuf 编译器（gRPC 必需）

**macOS**:
```bash
brew install protobuf
protoc --version  # 应该是 3.20+
```

**Linux**:
```bash
# 方法1: 使用包管理器（可能版本较旧）
sudo apt install protobuf-compiler

# 方法2: 手动安装最新版本
PROTOC_VERSION=25.1
curl -LO https://github.com/protocolbuffers/protobuf/releases/download/v${PROTOC_VERSION}/protoc-${PROTOC_VERSION}-linux-x86_64.zip
unzip protoc-${PROTOC_VERSION}-linux-x86_64.zip -d $HOME/.local
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
protoc --version
```

---

## 四、Rust 开发环境

### 安装 Rust

**所有平台（使用 rustup）**:
```bash
# 1. 安装 rustup（Rust 版本管理器）
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 2. 选择安装选项
# - 选择 1（默认安装）

# 3. 配置环境变量（自动添加到 shell 配置文件）
source $HOME/.cargo/env

# 4. 验证安装
rustc --version  # 应该是 1.75+
cargo --version
rustup --version
```

### 配置 Cargo 镜像源（中国大陆用户）

```bash
# 创建 Cargo 配置文件
mkdir -p ~/.cargo
cat > ~/.cargo/config.toml << 'EOF'
[source.crates-io]
replace-with = 'ustc'

[source.ustc]
registry = "sparse+https://mirrors.ustc.edu.cn/crates.io-index/"

[net]
git-fetch-with-cli = true
EOF
```

### 安装常用 Rust 工具

```bash
# 代码格式化工具
rustup component add rustfmt

# 代码检查工具
rustup component add clippy

# Rust 文档工具
rustup component add rust-docs

# 代码覆盖率工具
cargo install cargo-tarpaulin

# 依赖安全审计工具
cargo install cargo-audit

# 监控文件变化自动编译
cargo install cargo-watch

# SQL 迁移工具
cargo install sqlx-cli --no-default-features --features postgres

# 验证安装
cargo fmt --version
cargo clippy --version
cargo tarpaulin --version
cargo audit --version
sqlx --version
```

---

## 五、IDE 配置

### VS Code（推荐）

**1. 安装 VS Code**:
- 下载地址: https://code.visualstudio.com/
- macOS: `brew install --cask visual-studio-code`
- Linux: 下载 `.deb` 或 `.rpm` 包安装

**2. 安装必需扩展**:

在 VS Code 中按 `Cmd+Shift+X`（macOS）或 `Ctrl+Shift+X`（Linux/Windows），搜索并安装：

| 扩展名 | 用途 | 必需程度 |
|-------|------|---------|
| rust-analyzer | Rust 语言支持（代码补全、跳转、重构） | ⭐⭐⭐⭐⭐ |
| CodeLLDB | Rust 调试器 | ⭐⭐⭐⭐⭐ |
| Even Better TOML | TOML 文件支持（Cargo.toml） | ⭐⭐⭐⭐ |
| Error Lens | 行内显示错误和警告 | ⭐⭐⭐⭐ |
| GitLens | Git 增强（查看提交历史、作者） | ⭐⭐⭐⭐ |
| Docker | Docker 文件支持 | ⭐⭐⭐ |
| Markdown All in One | Markdown 编辑增强 | ⭐⭐⭐ |
| REST Client | API 测试（发送 HTTP 请求） | ⭐⭐⭐ |
| PostgreSQL | PostgreSQL 查询和管理 | ⭐⭐⭐ |

**3. 配置 VS Code 设置**:

打开设置（`Cmd+,` 或 `Ctrl+,`），搜索并配置：

```json
{
    // Rust-Analyzer 配置
    "rust-analyzer.check.command": "clippy",
    "rust-analyzer.check.extraArgs": ["--", "-D", "warnings"],
    "rust-analyzer.cargo.features": "all",

    // 保存时自动格式化
    "editor.formatOnSave": true,
    "[rust]": {
        "editor.defaultFormatter": "rust-lang.rust-analyzer"
    },

    // 保存时自动运行 Clippy
    "rust-analyzer.checkOnSave": true,

    // 显示提示类型
    "editor.inlayHints.enabled": "on",

    // 文件保存时自动修复
    "editor.codeActionsOnSave": {
        "source.fixAll": true
    },

    // Git 配置
    "git.autofetch": true,
    "git.confirmSync": false,

    // 终端配置
    "terminal.integrated.defaultProfile.osx": "zsh",
    "terminal.integrated.fontSize": 14
}
```

**4. 配置调试（launch.json）**:

创建 `.vscode/launch.json`:
```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "type": "lldb",
            "request": "launch",
            "name": "Debug executable",
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
            "cwd": "${workspaceFolder}"
        },
        {
            "type": "lldb",
            "request": "launch",
            "name": "Debug unit tests",
            "cargo": {
                "args": [
                    "test",
                    "--no-run",
                    "--lib",
                    "--package=financial-service"
                ],
                "filter": {
                    "name": "financial-service",
                    "kind": "lib"
                }
            },
            "args": [],
            "cwd": "${workspaceFolder}"
        }
    ]
}
```

### 其他 IDE 选项

**JetBrains RustRover**:
- 专业 Rust IDE（付费，有免费试用）
- 下载: https://www.jetbrains.com/rust/
- 功能强大但资源占用较大

**Vim/Neovim**:
- 适合 Vim 高手
- 需要配置 coc.nvim + rust-analyzer
- 配置复杂但性能优秀

---

## 六、数据库环境

### 安装 Docker（推荐方式）

**macOS**:
```bash
# 1. 安装 Docker Desktop
brew install --cask docker

# 2. 启动 Docker Desktop（从应用程序中打开）

# 3. 验证安装
docker --version
docker-compose --version
```

**Linux**:
```bash
# 1. 安装 Docker Engine
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 2. 将当前用户添加到 docker 组（避免每次 sudo）
sudo usermod -aG docker $USER
newgrp docker

# 3. 启动 Docker 服务
sudo systemctl start docker
sudo systemctl enable docker

# 4. 验证安装
docker --version

# 5. 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.23.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
docker-compose --version
```

### 启动 PostgreSQL（Docker）

**创建 docker-compose.yml**:
```yaml
# 在项目根目录创建 docker-compose.dev.yml
version: '3.8'

services:
  postgres:
    image: postgres:16
    container_name: erp-postgres-dev
    environment:
      POSTGRES_USER: erp_user
      POSTGRES_PASSWORD: erp_password
      POSTGRES_DB: erp_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U erp_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: erp-pgadmin-dev
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@example.com
      PGADMIN_DEFAULT_PASSWORD: admin
    ports:
      - "5050:80"
    depends_on:
      - postgres

volumes:
  postgres_data:
```

**启动数据库**:
```bash
# 启动
docker-compose -f docker-compose.dev.yml up -d

# 查看日志
docker-compose -f docker-compose.dev.yml logs -f postgres

# 停止
docker-compose -f docker-compose.dev.yml down

# 停止并删除数据（慎用！）
docker-compose -f docker-compose.dev.yml down -v
```

**访问数据库**:
- PostgreSQL: `localhost:5432`
- 用户名: `erp_user`
- 密码: `erp_password`
- 数据库: `erp_dev`
- pgAdmin: http://localhost:5050

**使用 psql 连接**:
```bash
# 方法1: 使用 Docker exec
docker exec -it erp-postgres-dev psql -U erp_user -d erp_dev

# 方法2: 安装本地 psql 客户端
# macOS
brew install postgresql@16
psql -h localhost -U erp_user -d erp_dev
```

---

## 七、消息队列环境

### 启动 Kafka（Docker）

**添加到 docker-compose.dev.yml**:
```yaml
  zookeeper:
    image: confluentinc/cp-zookeeper:7.5.0
    container_name: erp-zookeeper-dev
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
    ports:
      - "2181:2181"

  kafka:
    image: confluentinc/cp-kafka:7.5.0
    container_name: erp-kafka-dev
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
    healthcheck:
      test: ["CMD-SHELL", "kafka-broker-api-versions --bootstrap-server localhost:9092"]
      interval: 10s
      timeout: 10s
      retries: 5

  kafka-ui:
    image: provectuslabs/kafka-ui:latest
    container_name: erp-kafka-ui-dev
    depends_on:
      - kafka
    ports:
      - "8080:8080"
    environment:
      KAFKA_CLUSTERS_0_NAME: local
      KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS: kafka:9092
```

**启动 Kafka**:
```bash
docker-compose -f docker-compose.dev.yml up -d kafka kafka-ui
```

**访问 Kafka UI**: http://localhost:8080

**创建测试 Topic**:
```bash
# 进入 Kafka 容器
docker exec -it erp-kafka-dev bash

# 创建 Topic
kafka-topics --create --topic test-topic \
  --bootstrap-server localhost:9092 \
  --partitions 3 \
  --replication-factor 1

# 列出所有 Topic
kafka-topics --list --bootstrap-server localhost:9092

# 退出容器
exit
```

### 启动 Redis（Docker）

**添加到 docker-compose.dev.yml**:
```yaml
  redis:
    image: redis:7-alpine
    container_name: erp-redis-dev
    command: redis-server --appendonly yes
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  redis-commander:
    image: rediscommander/redis-commander:latest
    container_name: erp-redis-ui-dev
    depends_on:
      - redis
    environment:
      - REDIS_HOSTS=local:redis:6379
    ports:
      - "8081:8081"

volumes:
  redis_data:
```

**访问 Redis**:
- Redis: `localhost:6379`
- Redis Commander: http://localhost:8081

---

## 八、容器环境

### 本地 Kubernetes（可选，用于测试部署）

**macOS（使用 Docker Desktop 内置 K8s）**:
1. 打开 Docker Desktop
2. Settings → Kubernetes → Enable Kubernetes
3. 等待启动完成

**或使用 k3d（轻量级 K8s）**:
```bash
# macOS
brew install k3d

# Linux
wget -q -O - https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash

# 创建集群
k3d cluster create erp-dev --agents 2

# 验证
kubectl get nodes
```

**安装 kubectl**:
```bash
# macOS
brew install kubectl

# Linux
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# 验证
kubectl version --client
```

---

## 九、项目代码获取

### 1. Clone 代码仓库

```bash
# 创建工作目录
mkdir -p ~/projects
cd ~/projects

# Clone 项目（使用 SSH）
git clone git@github.com:your-org/rust-erp.git
cd rust-erp

# 查看分支
git branch -a

# 切换到开发分支
git checkout develop
```

### 2. 安装项目依赖

```bash
# 下载并编译所有依赖（首次较慢，10-30分钟）
cargo build

# 只检查编译（不生成二进制，更快）
cargo check
```

### 3. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量
vim .env  # 或使用你喜欢的编辑器
```

**.env 示例**:
```bash
# 数据库
DATABASE_URL=postgres://erp_user:erp_password@localhost:5432/erp_dev

# Redis
REDIS_URL=redis://localhost:6379

# Kafka
KAFKA_BROKERS=localhost:9092

# 日志级别
RUST_LOG=info,financial_service=debug

# 服务端口
SERVICE_PORT=8001
```

### 4. 运行数据库迁移

```bash
# 进入某个服务目录
cd services/financial-service

# 运行迁移
sqlx migrate run

# 验证迁移
sqlx migrate info
```

---

## 十、环境验证

### 全自动验证脚本

创建 `scripts/verify-env.sh`:
```bash
#!/bin/bash

echo "=== Rust ERP 开发环境验证脚本 ==="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

check_command() {
    if command -v $1 &> /dev/null; then
        echo -e "${GREEN}✓${NC} $1 已安装: $($1 --version | head -n 1)"
    else
        echo -e "${RED}✗${NC} $1 未安装"
        return 1
    fi
}

check_port() {
    if nc -z localhost $1 2>/dev/null; then
        echo -e "${GREEN}✓${NC} 端口 $1 ($2) 可访问"
    else
        echo -e "${RED}✗${NC} 端口 $1 ($2) 不可访问"
        return 1
    fi
}

echo "--- 检查基础工具 ---"
check_command git
check_command docker
check_command docker-compose
check_command rustc
check_command cargo
check_command protoc
check_command sqlx

echo ""
echo "--- 检查 Cargo 工具 ---"
check_command cargo-fmt
check_command cargo-clippy
check_command cargo-tarpaulin
check_command cargo-audit

echo ""
echo "--- 检查服务端口 ---"
check_port 5432 "PostgreSQL"
check_port 6379 "Redis"
check_port 9092 "Kafka"

echo ""
echo "--- 检查 Docker 容器 ---"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep erp-

echo ""
echo "--- 测试数据库连接 ---"
if psql $DATABASE_URL -c "SELECT 1" &> /dev/null; then
    echo -e "${GREEN}✓${NC} PostgreSQL 连接成功"
else
    echo -e "${RED}✗${NC} PostgreSQL 连接失败"
fi

echo ""
echo "=== 验证完成 ==="
```

**运行验证**:
```bash
chmod +x scripts/verify-env.sh
./scripts/verify-env.sh
```

### 手动验证步骤

**1. 验证 Rust 环境**:
```bash
# 编译测试项目
cargo new hello-rust
cd hello-rust
cargo run
# 应该输出 "Hello, world!"
```

**2. 验证数据库**:
```bash
# 连接数据库
psql -h localhost -U erp_user -d erp_dev

# 在 psql 中执行
CREATE TABLE test (id SERIAL PRIMARY KEY, name VARCHAR(50));
INSERT INTO test (name) VALUES ('Hello');
SELECT * FROM test;
DROP TABLE test;
\q
```

**3. 验证 Redis**:
```bash
# 使用 redis-cli
docker exec -it erp-redis-dev redis-cli

# 在 redis-cli 中执行
PING
# 应该返回 PONG

SET test "Hello Redis"
GET test
# 应该返回 "Hello Redis"

DEL test
EXIT
```

**4. 验证 Kafka**:
```bash
# 发送测试消息
docker exec -it erp-kafka-dev kafka-console-producer \
  --broker-list localhost:9092 \
  --topic test-topic
# 输入一些消息，按 Ctrl+C 退出

# 消费测试消息
docker exec -it erp-kafka-dev kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic test-topic \
  --from-beginning
# 应该看到刚才发送的消息
```

**5. 验证项目编译**:
```bash
# 在项目根目录
cd ~/projects/rust-erp

# 检查所有服务
cargo check --workspace

# 运行测试
cargo test --workspace

# 运行某个服务
cargo run --bin financial-service
# 应该看到服务启动日志
```

---

## 十一、常见问题

### Q1: Cargo 下载依赖很慢

**A1**: 配置国内镜像源（见第四章），或使用代理：
```bash
# 设置代理（临时）
export https_proxy=http://127.0.0.1:7890
export http_proxy=http://127.0.0.1:7890

# 或在 ~/.cargo/config.toml 中配置
[http]
proxy = "127.0.0.1:7890"
```

### Q2: rust-analyzer 很慢或卡死

**A2**:
```bash
# 1. 清理 target 目录
cargo clean

# 2. 重启 rust-analyzer
# 在 VS Code 中: Cmd+Shift+P → "Reload Window"

# 3. 禁用部分检查（在 VS Code 设置中）
"rust-analyzer.checkOnSave.allTargets": false
```

### Q3: Docker 容器无法启动

**A3**:
```bash
# 查看容器日志
docker-compose -f docker-compose.dev.yml logs postgres

# 查看容器状态
docker ps -a | grep erp

# 删除所有容器重新开始
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d
```

### Q4: 数据库连接被拒绝

**A4**:
```bash
# 1. 检查容器是否运行
docker ps | grep postgres

# 2. 检查端口是否被占用
lsof -i :5432  # macOS/Linux
netstat -ano | findstr :5432  # Windows

# 3. 检查 DATABASE_URL 是否正确
echo $DATABASE_URL

# 4. 测试连接
docker exec -it erp-postgres-dev psql -U erp_user -d erp_dev
```

### Q5: 编译错误：链接器错误

**A5**:
```bash
# macOS: 安装 Xcode Command Line Tools
xcode-select --install

# Linux: 安装 build-essential
sudo apt install build-essential

# 检查链接器
which ld
ld --version
```

### Q6: 内存不足，编译失败

**A6**:
```bash
# 减少并行编译任务数
export CARGO_BUILD_JOBS=2

# 或在 ~/.cargo/config.toml 中配置
[build]
jobs = 2

# 增加交换空间（Linux）
sudo fallocate -l 8G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### Q7: SQLx 编译时检查失败

**A7**:
```bash
# 1. 确保数据库正在运行
docker ps | grep postgres

# 2. 确保 DATABASE_URL 正确
echo $DATABASE_URL

# 3. 运行迁移
cd services/financial-service
sqlx migrate run

# 4. 准备 SQLx 离线模式（可选）
cargo sqlx prepare
```

---

