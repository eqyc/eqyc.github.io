# Rust ERP 系统部署运维手册

## 1. 部署架构概览

### 1.1 环境划分

| 环境 | 用途 | 访问控制 | 数据备份 |
|-----|------|---------|---------|
| **开发环境** (dev) | 日常开发、功能调试 | 开发团队 | 不备份 |
| **测试环境** (test) | 集成测试、QA 测试 | 开发+QA团队 | 不备份 |
| **预发布环境** (staging) | 上线前验证、压力测试 | 开发+运维团队 | 每日备份 |
| **生产环境** (production) | 正式对外服务 | 仅运维团队 | 实时备份 |

### 1.2 生产环境拓扑

```
┌─────────────────────────────────────────────────────────────────┐
│                         CDN / CloudFlare                         │
│                    静态资源、全球加速                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓ HTTPS
┌─────────────────────────────────────────────────────────────────┐
│                      负载均衡器 (Load Balancer)                   │
│              AWS ALB / Nginx + Keepalived                        │
│              IP: 10.0.1.10 (VIP)                                 │
└─────────────────────────────────────────────────────────────────┘
                    ↓                        ↓
    ┌───────────────────────┐    ┌───────────────────────┐
    │  Kubernetes Cluster   │    │  Kubernetes Cluster   │
    │  Zone: us-east-1a     │    │  Zone: us-east-1b     │
    │  ┌─────────────────┐  │    │  ┌─────────────────┐  │
    │  │  财务服务 Pod×3  │  │    │  │  财务服务 Pod×3  │  │
    │  │  销售服务 Pod×3  │  │    │  │  销售服务 Pod×3  │  │
    │  │  物料服务 Pod×3  │  │    │  │  物料服务 Pod×3  │  │
    │  └─────────────────┘  │    │  └─────────────────┘  │
    └───────────────────────┘    └───────────────────────┘
                    ↓                        ↓
┌─────────────────────────────────────────────────────────────────┐
│                      数据层（高可用集群）                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ PostgreSQL   │  │    Redis     │  │    Kafka     │          │
│  │ Master-Slave │  │   Cluster    │  │   Cluster    │          │
│  │  + Patroni   │  │ Sentinel×3   │  │  Broker×3    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                    ↓                        ↓
┌─────────────────────────────────────────────────────────────────┐
│                      监控与日志系统                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Prometheus   │  │   Grafana    │  │   Loki +     │          │
│  │   + Alert    │  │ Dashboards   │  │  Jaeger      │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Kubernetes 部署配置

### 2.1 命名空间创建

```yaml
# namespaces/production.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: erp-prod
  labels:
    environment: production
    team: erp-platform

---
apiVersion: v1
kind: Namespace
metadata:
  name: erp-infra
  labels:
    environment: production
    team: infrastructure
```

**应用命名空间**：

```bash
kubectl apply -f namespaces/production.yaml
```

---

### 2.2 ConfigMap 配置

```yaml
# config/financial-service-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: financial-service-config
  namespace: erp-prod
data:
  APP_NAME: "financial-service"
  APP_ENV: "production"
  LOG_LEVEL: "info"

  # 数据库配置（非敏感）
  DATABASE_MAX_CONNECTIONS: "20"
  DATABASE_MIN_CONNECTIONS: "5"

  # Redis 配置
  REDIS_MAX_CONNECTIONS: "50"

  # Kafka 配置
  KAFKA_BROKERS: "kafka-0.kafka-headless.erp-infra.svc.cluster.local:9092,kafka-1.kafka-headless.erp-infra.svc.cluster.local:9092,kafka-2.kafka-headless.erp-infra.svc.cluster.local:9092"
  KAFKA_GROUP_ID: "financial-service-prod-group"
  KAFKA_TOPIC_TRANSACTION_POSTED: "financial.transaction.posted"

  # OpenTelemetry
  OTEL_EXPORTER_JAEGER_ENDPOINT: "http://jaeger-collector.erp-infra.svc.cluster.local:14268/api/traces"
  OTEL_SERVICE_NAME: "financial-service"

  # Prometheus
  PROMETHEUS_METRICS_PORT: "9091"
```

---

### 2.3 Secret 管理

```yaml
# secrets/financial-service-secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: financial-service-secrets
  namespace: erp-prod
type: Opaque
stringData:
  DATABASE_URL: "postgres://financial_user:PROD_PASSWORD_HERE@postgres-primary.erp-infra.svc.cluster.local:5432/financial_db?sslmode=require"
  REDIS_URL: "redis://:REDIS_PROD_PASSWORD@redis-master.erp-infra.svc.cluster.local:6379/0"
  JWT_SECRET: "CHANGE-THIS-TO-STRONG-SECRET-IN-PRODUCTION-MIN-32-CHARS"

  # 加密密钥（用于敏感数据加密）
  ENCRYPTION_KEY: "BASE64_ENCODED_AES_256_KEY_HERE"
```

**创建 Secret**（推荐使用加密工具）：

```bash
# 方案1：使用 kubectl 直接创建（不推荐，会留下历史记录）
kubectl apply -f secrets/financial-service-secrets.yaml

# 方案2：使用 Sealed Secrets（推荐）
kubeseal --format=yaml < secrets/financial-service-secrets.yaml > secrets/financial-service-sealed-secrets.yaml
kubectl apply -f secrets/financial-service-sealed-secrets.yaml

# 方案3：使用 Vault（企业推荐）
# 集成 HashiCorp Vault，动态获取密钥
```

---

### 2.4 Deployment 部署配置

```yaml
# deployments/financial-service.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: financial-service
  namespace: erp-prod
  labels:
    app: financial-service
    version: v1.0.0
spec:
  replicas: 3  # 生产环境至少3副本
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1         # 最多额外创建1个Pod
      maxUnavailable: 0   # 滚动更新期间保持所有Pod可用
  selector:
    matchLabels:
      app: financial-service
  template:
    metadata:
      labels:
        app: financial-service
        version: v1.0.0
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9091"
        prometheus.io/path: "/metrics"
    spec:
      # 亲和性配置（Pod 分散到不同节点）
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchExpressions:
                    - key: app
                      operator: In
                      values:
                        - financial-service
                topologyKey: kubernetes.io/hostname

      # 容器配置
      containers:
        - name: financial-service
          image: registry.example.com/erp/financial-service:1.0.0
          imagePullPolicy: IfNotPresent

          # 端口
          ports:
            - name: http
              containerPort: 8000
              protocol: TCP
            - name: grpc
              containerPort: 50051
              protocol: TCP
            - name: metrics
              containerPort: 9091
              protocol: TCP

          # 环境变量
          env:
            - name: APP_HOST
              value: "0.0.0.0"
            - name: APP_PORT
              value: "8000"

          # 从 ConfigMap 加载环境变量
          envFrom:
            - configMapRef:
                name: financial-service-config
            - secretRef:
                name: financial-service-secrets

          # 资源限制
          resources:
            requests:
              cpu: "500m"        # 0.5核
              memory: "512Mi"
            limits:
              cpu: "2000m"       # 2核
              memory: "2Gi"

          # 健康检查
          livenessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3

          readinessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 10
            periodSeconds: 5
            timeoutSeconds: 3
            successThreshold: 1
            failureThreshold: 3

          # 启动探针（避免慢启动被 kill）
          startupProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 0
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 30  # 允许最多150秒启动时间

          # 安全上下文
          securityContext:
            runAsNonRoot: true
            runAsUser: 1000
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop:
                - ALL

          # 挂载卷
          volumeMounts:
            - name: tmp
              mountPath: /tmp
            - name: config
              mountPath: /app/config
              readOnly: true

      # 卷定义
      volumes:
        - name: tmp
          emptyDir: {}
        - name: config
          configMap:
            name: financial-service-config

      # 镜像拉取凭证
      imagePullSecrets:
        - name: registry-credentials

      # 优雅关闭时间
      terminationGracePeriodSeconds: 60
```

**部署应用**：

```bash
kubectl apply -f deployments/financial-service.yaml

# 查看部署状态
kubectl rollout status deployment/financial-service -n erp-prod

# 查看 Pod 状态
kubectl get pods -n erp-prod -l app=financial-service

# 查看 Pod 日志
kubectl logs -f deployment/financial-service -n erp-prod
```

---

### 2.5 Service 配置

```yaml
# services/financial-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: financial-service
  namespace: erp-prod
  labels:
    app: financial-service
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: "nlb"  # AWS NLB
spec:
  type: ClusterIP  # 内部服务使用 ClusterIP
  selector:
    app: financial-service
  ports:
    - name: http
      port: 80
      targetPort: 8000
      protocol: TCP
    - name: grpc
      port: 50051
      targetPort: 50051
      protocol: TCP
    - name: metrics
      port: 9091
      targetPort: 9091
      protocol: TCP
  sessionAffinity: None
```

---

### 2.6 Ingress 配置（外部访问）

```yaml
# ingress/financial-service-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: financial-service-ingress
  namespace: erp-prod
  annotations:
    # Nginx Ingress 配置
    kubernetes.io/ingress.class: "nginx"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"

    # 限流配置
    nginx.ingress.kubernetes.io/limit-rps: "100"
    nginx.ingress.kubernetes.io/limit-connections: "50"

    # CORS 配置
    nginx.ingress.kubernetes.io/enable-cors: "true"
    nginx.ingress.kubernetes.io/cors-allow-origin: "https://erp.example.com"

    # 超时配置
    nginx.ingress.kubernetes.io/proxy-connect-timeout: "60"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "60"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "60"

    # TLS 证书（cert-manager 自动管理）
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
    - hosts:
        - api.erp.example.com
      secretName: api-erp-tls
  rules:
    - host: api.erp.example.com
      http:
        paths:
          - path: /financial
            pathType: Prefix
            backend:
              service:
                name: financial-service
                port:
                  number: 80
          - path: /sales
            pathType: Prefix
            backend:
              service:
                name: sales-service
                port:
                  number: 80
```

---

### 2.7 HorizontalPodAutoscaler（自动扩缩容）

```yaml
# hpa/financial-service-hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: financial-service-hpa
  namespace: erp-prod
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: financial-service
  minReplicas: 3
  maxReplicas: 20
  metrics:
    # CPU 利用率
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70  # CPU 超过70%触发扩容

    # 内存利用率
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80

    # 自定义指标：HTTP 请求速率（需要 Prometheus Adapter）
    - type: Pods
      pods:
        metric:
          name: http_requests_per_second
        target:
          type: AverageValue
          averageValue: "1000"  # 每秒超过1000请求时扩容

  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300  # 缩容稳定窗口5分钟
      policies:
        - type: Percent
          value: 50              # 每次最多缩容50%
          periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
        - type: Percent
          value: 100             # 每次最多扩容100%（翻倍）
          periodSeconds: 15
        - type: Pods
          value: 4               # 每次最多增加4个Pod
          periodSeconds: 15
      selectPolicy: Max          # 选择最大扩容策略
```

---

## 3. 数据库部署

### 3.1 PostgreSQL 高可用部署（Patroni + etcd）

使用 Bitnami PostgreSQL HA Helm Chart：

```bash
# 添加 Bitnami Helm 仓库
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# 创建 values.yaml 配置文件
cat > postgres-ha-values.yaml << 'EOF'
postgresql:
  replicaCount: 3  # 1个主节点 + 2个从节点

  image:
    tag: "16.1.0"

  auth:
    enablePostgresUser: true
    postgresPassword: "CHANGE_ME_POSTGRES_PASSWORD"
    username: "erp_user"
    password: "CHANGE_ME_ERP_PASSWORD"
    database: "erp_prod"

  resources:
    requests:
      cpu: "1000m"
      memory: "2Gi"
    limits:
      cpu: "4000m"
      memory: "8Gi"

  persistence:
    enabled: true
    storageClass: "gp3"  # AWS EBS gp3
    size: "100Gi"

  metrics:
    enabled: true
    serviceMonitor:
      enabled: true

pgpool:
  replicaCount: 2

  adminUsername: "admin"
  adminPassword: "CHANGE_ME_ADMIN_PASSWORD"

  resources:
    requests:
      cpu: "250m"
      memory: "256Mi"
    limits:
      cpu: "1000m"
      memory: "1Gi"

etcd:
  replicaCount: 3

  persistence:
    enabled: true
    storageClass: "gp3"
    size: "10Gi"
EOF

# 部署 PostgreSQL HA 集群
helm install postgres-ha bitnami/postgresql-ha \
  --namespace erp-infra \
  --create-namespace \
  --values postgres-ha-values.yaml

# 查看部署状态
kubectl get pods -n erp-infra -l app.kubernetes.io/name=postgresql-ha

# 获取连接信息
export POSTGRES_PASSWORD=$(kubectl get secret --namespace erp-infra postgres-ha-postgresql-ha-postgresql -o jsonpath="{.data.password}" | base64 -d)
echo "PostgreSQL Password: $POSTGRES_PASSWORD"

# 连接到主节点
kubectl run postgres-client --rm --tty -i --restart='Never' --namespace erp-infra \
  --image docker.io/bitnami/postgresql:16 \
  --env="PGPASSWORD=$POSTGRES_PASSWORD" \
  --command -- psql --host postgres-ha-postgresql-ha-pgpool -U erp_user -d erp_prod -p 5432
```

---

### 3.2 Redis 高可用部署（Sentinel）

```bash
# 创建 Redis values.yaml
cat > redis-ha-values.yaml << 'EOF'
architecture: replication

auth:
  enabled: true
  password: "CHANGE_ME_REDIS_PASSWORD"

master:
  replicaCount: 1
  persistence:
    enabled: true
    storageClass: "gp3"
    size: "10Gi"
  resources:
    requests:
      cpu: "250m"
      memory: "512Mi"
    limits:
      cpu: "1000m"
      memory: "2Gi"

replica:
  replicaCount: 2
  persistence:
    enabled: true
    storageClass: "gp3"
    size: "10Gi"
  resources:
    requests:
      cpu: "250m"
      memory: "512Mi"
    limits:
      cpu: "1000m"
      memory: "2Gi"

sentinel:
  enabled: true
  quorum: 2
  downAfterMilliseconds: 5000
  failoverTimeout: 10000
EOF

# 部署 Redis 集群
helm install redis-ha bitnami/redis \
  --namespace erp-infra \
  --values redis-ha-values.yaml

# 获取 Redis 密码
export REDIS_PASSWORD=$(kubectl get secret --namespace erp-infra redis-ha -o jsonpath="{.data.redis-password}" | base64 -d)

# 连接到 Redis
kubectl run redis-client --rm --tty -i --restart='Never' --namespace erp-infra \
  --image docker.io/bitnami/redis:7.2 \
  --env REDIS_PASSWORD=$REDIS_PASSWORD \
  --command -- redis-cli -h redis-ha-master -a $REDIS_PASSWORD
```

---

### 3.3 Kafka 集群部署

```bash
# 创建 Kafka values.yaml
cat > kafka-values.yaml << 'EOF'
replicaCount: 3

zookeeper:
  enabled: true
  replicaCount: 3
  persistence:
    enabled: true
    storageClass: "gp3"
    size: "10Gi"

persistence:
  enabled: true
  storageClass: "gp3"
  size: "50Gi"

resources:
  requests:
    cpu: "500m"
    memory: "1Gi"
  limits:
    cpu: "2000m"
    memory: "4Gi"

metrics:
  kafka:
    enabled: true
  jmx:
    enabled: true

listeners:
  client:
    protocol: PLAINTEXT
  controller:
    protocol: PLAINTEXT
  interbroker:
    protocol: PLAINTEXT
  external:
    protocol: PLAINTEXT

externalAccess:
  enabled: false
EOF

# 部署 Kafka 集群
helm install kafka bitnami/kafka \
  --namespace erp-infra \
  --values kafka-values.yaml

# 创建 Kafka 主题
kubectl run kafka-client --rm --tty -i --restart='Never' --namespace erp-infra \
  --image docker.io/bitnami/kafka:3.6 \
  --command -- kafka-topics.sh \
    --bootstrap-server kafka-0.kafka-headless.erp-infra.svc.cluster.local:9092 \
    --create \
    --topic financial.transaction.posted \
    --partitions 6 \
    --replication-factor 3
```

---

## 4. CI/CD 流水线

### 4.1 GitHub Actions 配置

创建 `.github/workflows/deploy-production.yml`：

```yaml
name: Deploy to Production

on:
  push:
    tags:
      - 'v*.*.*'  # 触发条件：推送版本标签（如 v1.0.0）

env:
  REGISTRY: registry.example.com
  IMAGE_NAME: erp/financial-service

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Rust
        uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
          profile: minimal
          override: true

      - name: Cache Cargo dependencies
        uses: actions/cache@v3
        with:
          path: |
            ~/.cargo/bin/
            ~/.cargo/registry/index/
            ~/.cargo/registry/cache/
            ~/.cargo/git/db/
            target/
          key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}

      - name: Run tests
        run: |
          cargo test --all --release

      - name: Build release binary
        run: |
          cargo build --release --package financial-service

      - name: Extract version
        id: extract_version
        run: |
          echo "VERSION=${GITHUB_REF#refs/tags/v}" >> $GITHUB_OUTPUT

      - name: Login to Docker Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ secrets.REGISTRY_USERNAME }}
          password: ${{ secrets.REGISTRY_PASSWORD }}

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: ./services/financial-service
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ steps.extract_version.outputs.VERSION }}
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
          cache-from: type=registry,ref=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
          cache-to: type=inline

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Extract version
        id: extract_version
        run: |
          echo "VERSION=${GITHUB_REF#refs/tags/v}" >> $GITHUB_OUTPUT

      - name: Configure kubectl
        uses: azure/k8s-set-context@v3
        with:
          method: kubeconfig
          kubeconfig: ${{ secrets.KUBE_CONFIG }}

      - name: Update Deployment image
        run: |
          kubectl set image deployment/financial-service \
            financial-service=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ steps.extract_version.outputs.VERSION }} \
            -n erp-prod

      - name: Wait for rollout
        run: |
          kubectl rollout status deployment/financial-service -n erp-prod --timeout=5m

      - name: Verify deployment
        run: |
          kubectl get pods -n erp-prod -l app=financial-service

      - name: Notify Slack
        if: always()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: |
            Deployment ${{ job.status }}
            Version: ${{ steps.extract_version.outputs.VERSION }}
            Service: financial-service
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

### 4.2 Dockerfile 优化（多阶段构建）

创建 `services/financial-service/Dockerfile`：

```dockerfile
# ===== 构建阶段 =====
FROM rust:1.75-slim-bookworm AS builder

# 安装依赖
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    cmake \
    && rm -rf /var/lib/apt/lists/*

# 创建工作目录
WORKDIR /app

# 复制 Cargo 文件并构建依赖（缓存层）
COPY Cargo.toml Cargo.lock ./
COPY shared/ ./shared/
COPY services/financial-service/Cargo.toml ./services/financial-service/

RUN mkdir -p services/financial-service/src && \
    echo "fn main() {}" > services/financial-service/src/main.rs && \
    cargo build --release --package financial-service && \
    rm -rf services/financial-service/src

# 复制源代码并构建
COPY services/financial-service/src ./services/financial-service/src
RUN touch services/financial-service/src/main.rs && \
    cargo build --release --package financial-service

# ===== 运行阶段 =====
FROM debian:bookworm-slim

# 安装运行时依赖
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# 创建非 root 用户
RUN useradd -m -u 1000 -s /bin/bash appuser

# 工作目录
WORKDIR /app

# 从构建阶段复制二进制文件
COPY --from=builder /app/target/release/financial-service /app/financial-service

# 切换到非 root 用户
USER appuser

# 暴露端口
EXPOSE 8000 50051 9091

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# 启动命令
ENTRYPOINT ["/app/financial-service"]
```

---

## 5. 监控告警配置

### 5.1 Prometheus 配置

创建 `config/prometheus.yml`：

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'erp-production'

# 告警规则文件
rule_files:
  - '/etc/prometheus/rules/*.yml'

# Alertmanager 配置
alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - 'alertmanager:9093'

# 抓取配置
scrape_configs:
  # Kubernetes API Server
  - job_name: 'kubernetes-apiservers'
    kubernetes_sd_configs:
      - role: endpoints
    scheme: https
    tls_config:
      ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
    bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
    relabel_configs:
      - source_labels: [__meta_kubernetes_namespace, __meta_kubernetes_service_name, __meta_kubernetes_endpoint_port_name]
        action: keep
        regex: default;kubernetes;https

  # Kubernetes Nodes
  - job_name: 'kubernetes-nodes'
    kubernetes_sd_configs:
      - role: node
    scheme: https
    tls_config:
      ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
    bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
    relabel_configs:
      - action: labelmap
        regex: __meta_kubernetes_node_label_(.+)

  # Kubernetes Pods（通过注解自动发现）
  - job_name: 'kubernetes-pods'
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)
      - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
        action: replace
        regex: ([^:]+)(?::\d+)?;(\d+)
        replacement: $1:$2
        target_label: __address__
      - action: labelmap
        regex: __meta_kubernetes_pod_label_(.+)
      - source_labels: [__meta_kubernetes_namespace]
        action: replace
        target_label: kubernetes_namespace
      - source_labels: [__meta_kubernetes_pod_name]
        action: replace
        target_label: kubernetes_pod_name

  # PostgreSQL Exporter
  - job_name: 'postgres'
    static_configs:
      - targets:
          - 'postgres-ha-postgresql-ha-metrics.erp-infra.svc.cluster.local:9187'

  # Redis Exporter
  - job_name: 'redis'
    static_configs:
      - targets:
          - 'redis-ha-metrics.erp-infra.svc.cluster.local:9121'

  # Kafka Exporter
  - job_name: 'kafka'
    static_configs:
      - targets:
          - 'kafka-0.kafka-headless.erp-infra.svc.cluster.local:5556'
          - 'kafka-1.kafka-headless.erp-infra.svc.cluster.local:5556'
          - 'kafka-2.kafka-headless.erp-infra.svc.cluster.local:5556'
```

---

### 5.2 告警规则

创建 `config/prometheus-rules/erp-alerts.yml`：

```yaml
groups:
  - name: erp_service_alerts
    interval: 30s
    rules:
      # 服务宕机告警
      - alert: ServiceDown
        expr: up{job=~"kubernetes-pods",app=~".*-service"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Service {{ $labels.app }} is down"
          description: "{{ $labels.app }} in namespace {{ $labels.kubernetes_namespace }} has been down for more than 2 minutes."

      # 高错误率告警
      - alert: HighErrorRate
        expr: |
          (
            rate(http_requests_total{status=~"5.."}[5m])
            /
            rate(http_requests_total[5m])
          ) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate on {{ $labels.app }}"
          description: "Error rate is {{ $value | humanizePercentage }} on {{ $labels.app }}"

      # 高延迟告警
      - alert: HighLatency
        expr: |
          histogram_quantile(0.95,
            rate(http_request_duration_seconds_bucket[5m])
          ) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High latency on {{ $labels.app }}"
          description: "P95 latency is {{ $value }}s on {{ $labels.app }}"

      # CPU 使用率过高
      - alert: HighCPUUsage
        expr: |
          (
            sum(rate(container_cpu_usage_seconds_total{namespace="erp-prod"}[5m])) by (pod)
            /
            sum(container_spec_cpu_quota{namespace="erp-prod"} / container_spec_cpu_period{namespace="erp-prod"}) by (pod)
          ) > 0.9
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage on pod {{ $labels.pod }}"
          description: "CPU usage is {{ $value | humanizePercentage }}"

      # 内存使用率过高
      - alert: HighMemoryUsage
        expr: |
          (
            container_memory_working_set_bytes{namespace="erp-prod"}
            /
            container_spec_memory_limit_bytes{namespace="erp-prod"}
          ) > 0.9
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage on pod {{ $labels.pod }}"
          description: "Memory usage is {{ $value | humanizePercentage }}"

  - name: database_alerts
    interval: 30s
    rules:
      # 数据库连接数过高
      - alert: HighDatabaseConnections
        expr: |
          pg_stat_database_numbackends{datname!~"template.*|postgres"}
          /
          pg_settings_max_connections > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High database connections on {{ $labels.datname }}"
          description: "Database connections usage is {{ $value | humanizePercentage }}"

      # 数据库死锁
      - alert: DatabaseDeadlocks
        expr: rate(pg_stat_database_deadlocks[5m]) > 0
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "Database deadlocks detected on {{ $labels.datname }}"
          description: "{{ $value }} deadlocks per second"

      # 慢查询过多
      - alert: HighSlowQueries
        expr: rate(pg_stat_database_tup_returned[5m]) / rate(pg_stat_database_tup_fetched[5m]) < 0.5
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High slow query ratio on {{ $labels.datname }}"
```

---

### 5.3 Grafana Dashboard

导入预配置的 Dashboard JSON（示例）：

```bash
# 使用 ConfigMap 挂载 Dashboard JSON
kubectl create configmap grafana-dashboards \
  --from-file=config/grafana/dashboards/ \
  -n erp-infra

# 在 Grafana Deployment 中挂载
# volumes:
#   - name: dashboards
#     configMap:
#       name: grafana-dashboards
# volumeMounts:
#   - name: dashboards
#     mountPath: /var/lib/grafana/dashboards
```

---

## 6. 备份与恢复

### 6.1 PostgreSQL 自动备份

创建 CronJob 定时备份：

```yaml
# cronjobs/postgres-backup.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
  namespace: erp-infra
spec:
  schedule: "0 2 * * *"  # 每天凌晨2点执行
  successfulJobsHistoryLimit: 7
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: postgres-backup
              image: postgres:16-alpine
              env:
                - name: PGHOST
                  value: "postgres-ha-postgresql-ha-pgpool.erp-infra.svc.cluster.local"
                - name: PGUSER
                  value: "erp_user"
                - name: PGPASSWORD
                  valueFrom:
                    secretKeyRef:
                      name: postgres-ha-postgresql-ha-postgresql
                      key: password
                - name: AWS_ACCESS_KEY_ID
                  valueFrom:
                    secretKeyRef:
                      name: aws-credentials
                      key: access-key-id
                - name: AWS_SECRET_ACCESS_KEY
                  valueFrom:
                    secretKeyRef:
                      name: aws-credentials
                      key: secret-access-key
              command:
                - /bin/sh
                - -c
                - |
                  set -e
                  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
                  BACKUP_FILE="financial_db_${TIMESTAMP}.sql.gz"

                  # 执行备份
                  pg_dump -h $PGHOST -U $PGUSER -d financial_db | gzip > /tmp/${BACKUP_FILE}

                  # 上传到 S3
                  apk add --no-cache aws-cli
                  aws s3 cp /tmp/${BACKUP_FILE} s3://erp-backups/postgres/${BACKUP_FILE}

                  # 清理本地文件
                  rm /tmp/${BACKUP_FILE}

                  # 删除30天前的备份
                  aws s3 ls s3://erp-backups/postgres/ | awk '{print $4}' | while read file; do
                    FILE_DATE=$(echo $file | grep -oP '\d{8}')
                    DAYS_OLD=$(( ($(date +%s) - $(date -d $FILE_DATE +%s)) / 86400 ))
                    if [ $DAYS_OLD -gt 30 ]; then
                      aws s3 rm s3://erp-backups/postgres/$file
                    fi
                  done

                  echo "Backup completed: ${BACKUP_FILE}"
              volumeMounts:
                - name: backup-tmp
                  mountPath: /tmp
          volumes:
            - name: backup-tmp
              emptyDir: {}
```

---

### 6.2 恢复流程

```bash
# 1. 下载备份文件
aws s3 cp s3://erp-backups/postgres/financial_db_20251221_020000.sql.gz /tmp/

# 2. 解压
gunzip /tmp/financial_db_20251221_020000.sql.gz

# 3. 恢复到数据库
kubectl run postgres-restore --rm -i --restart='Never' --namespace erp-infra \
  --image postgres:16-alpine \
  --env="PGPASSWORD=$POSTGRES_PASSWORD" \
  -- psql -h postgres-ha-postgresql-ha-pgpool -U erp_user -d financial_db < /tmp/financial_db_20251221_020000.sql
```

---

## 7. 日常运维操作

### 7.1 滚动更新

```bash
# 更新镜像版本
kubectl set image deployment/financial-service \
  financial-service=registry.example.com/erp/financial-service:1.1.0 \
  -n erp-prod

# 查看滚动更新状态
kubectl rollout status deployment/financial-service -n erp-prod

# 查看更新历史
kubectl rollout history deployment/financial-service -n erp-prod

# 回滚到上一个版本
kubectl rollout undo deployment/financial-service -n erp-prod

# 回滚到指定版本
kubectl rollout undo deployment/financial-service --to-revision=3 -n erp-prod
```

---

### 7.2 扩缩容

```bash
# 手动扩容
kubectl scale deployment/financial-service --replicas=5 -n erp-prod

# 查看 HPA 状态
kubectl get hpa -n erp-prod

# 编辑 HPA 配置
kubectl edit hpa financial-service-hpa -n erp-prod
```

---

### 7.3 日志查看

```bash
# 查看 Pod 日志
kubectl logs -f deployment/financial-service -n erp-prod

# 查看多个 Pod 日志（使用 stern）
stern financial-service -n erp-prod

# 查看最近100行日志
kubectl logs --tail=100 deployment/financial-service -n erp-prod

# 查看之前的 Pod 日志（崩溃后）
kubectl logs --previous deployment/financial-service -n erp-prod
```

---

### 7.4 进入容器调试

```bash
# 进入 Pod shell
kubectl exec -it deployment/financial-service -n erp-prod -- /bin/bash

# 运行临时调试容器（ephemeral container）
kubectl debug -it financial-service-xxx -n erp-prod --image=busybox --target=financial-service

# 查看容器资源使用情况
kubectl top pods -n erp-prod
kubectl top nodes
```

---

## 8. 故障排查手册

### 8.1 Pod 无法启动

**症状**: Pod 状态为 `CrashLoopBackOff` 或 `Error`

**排查步骤**:

```bash
# 1. 查看 Pod 事件
kubectl describe pod <pod-name> -n erp-prod

# 2. 查看容器日志
kubectl logs <pod-name> -n erp-prod --previous

# 3. 检查资源限制
kubectl get pod <pod-name> -n erp-prod -o yaml | grep -A 10 resources

# 4. 检查配置是否正确
kubectl get configmap financial-service-config -n erp-prod -o yaml
kubectl get secret financial-service-secrets -n erp-prod -o yaml

# 5. 检查镜像是否存在
kubectl describe pod <pod-name> -n erp-prod | grep Image
```

---

### 8.2 数据库连接失败

**排查步骤**:

```bash
# 1. 检查数据库服务是否正常
kubectl get pods -n erp-infra | grep postgres

# 2. 测试数据库连接
kubectl run pg-test --rm -it --restart='Never' --namespace erp-infra \
  --image postgres:16-alpine \
  --env="PGPASSWORD=$POSTGRES_PASSWORD" \
  -- psql -h postgres-ha-postgresql-ha-pgpool -U erp_user -d financial_db -c "SELECT 1;"

# 3. 检查数据库连接数
kubectl exec -it postgres-ha-postgresql-ha-postgresql-0 -n erp-infra -- \
  psql -U erp_user -d financial_db -c "SELECT count(*) FROM pg_stat_activity;"

# 4. 查看慢查询
kubectl exec -it postgres-ha-postgresql-ha-postgresql-0 -n erp-infra -- \
  psql -U erp_user -d financial_db -c "SELECT pid, now() - pg_stat_activity.query_start AS duration, query FROM pg_stat_activity WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';"
```

---

### 8.3 性能问题

**排查步骤**:

```bash
# 1. 查看 CPU 和内存使用率
kubectl top pods -n erp-prod

# 2. 查看 Prometheus 指标
# 访问 Grafana Dashboard: http://grafana.example.com

# 3. 查看请求延迟分布
# 使用 Jaeger 追踪: http://jaeger.example.com

# 4. 分析数据库查询性能
kubectl exec -it postgres-ha-postgresql-ha-postgresql-0 -n erp-infra -- \
  psql -U erp_user -d financial_db -c "SELECT query, calls, total_time, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

---

## 9. 安全加固

### 9.1 网络策略

```yaml
# network-policies/financial-service-netpol.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: financial-service-netpol
  namespace: erp-prod
spec:
  podSelector:
    matchLabels:
      app: financial-service
  policyTypes:
    - Ingress
    - Egress
  ingress:
    # 允许来自 Ingress Controller 的流量
    - from:
        - namespaceSelector:
            matchLabels:
              name: ingress-nginx
      ports:
        - protocol: TCP
          port: 8000
    # 允许来自其他微服务的 gRPC 流量
    - from:
        - podSelector:
            matchLabels:
              app: sales-service
      ports:
        - protocol: TCP
          port: 50051
    # 允许 Prometheus 抓取指标
    - from:
        - namespaceSelector:
            matchLabels:
              name: erp-infra
        - podSelector:
            matchLabels:
              app: prometheus
      ports:
        - protocol: TCP
          port: 9091
  egress:
    # 允许访问数据库
    - to:
        - namespaceSelector:
            matchLabels:
              name: erp-infra
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: postgresql-ha
      ports:
        - protocol: TCP
          port: 5432
    # 允许访问 Redis
    - to:
        - namespaceSelector:
            matchLabels:
              name: erp-infra
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: redis
      ports:
        - protocol: TCP
          port: 6379
    # 允许访问 Kafka
    - to:
        - namespaceSelector:
            matchLabels:
              name: erp-infra
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: kafka
      ports:
        - protocol: TCP
          port: 9092
    # 允许 DNS 查询
    - to:
        - namespaceSelector:
            matchLabels:
              name: kube-system
        - podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - protocol: UDP
          port: 53
```

---

## 10. 成本优化

### 10.1 资源请求优化

```bash
# 分析实际资源使用情况
kubectl top pods -n erp-prod --containers

# 使用 VPA (Vertical Pod Autoscaler) 自动调整资源请求
kubectl apply -f https://github.com/kubernetes/autoscaler/releases/download/vertical-pod-autoscaler-0.13.0/vpa-v0.13.0.yaml

# 创建 VPA 配置
cat > vpa-financial-service.yaml << 'EOF'
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: financial-service-vpa
  namespace: erp-prod
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: financial-service
  updatePolicy:
    updateMode: "Auto"  # 自动应用建议
  resourcePolicy:
    containerPolicies:
      - containerName: financial-service
        minAllowed:
          cpu: "250m"
          memory: "256Mi"
        maxAllowed:
          cpu: "4000m"
          memory: "4Gi"
EOF

kubectl apply -f vpa-financial-service.yaml
```

---

**文档版本**: v1.0
**最后更新**: 2025-12-21
**维护者**: ERP 运维团队
