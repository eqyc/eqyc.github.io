# Rust ERP 系统项目目录结构（附中文注释）

```
/                                    # 项目根目录
├── Cargo.toml                                 # Workspace工作空间配置文件
├── Cargo.lock                                 # 依赖锁定文件
├── .github/                                   # GitHub相关配置
│   └── workflows/                             # GitHub Actions工作流
│       ├── ci.yml                             # 持续集成流程
│       ├── deploy-staging.yml                 # 部署到预发环境
│       ├── deploy-production.yml              # 部署到生产环境
│       └── security-audit.yml                 # 安全审计流程
├── .gitignore                                 # Git忽略文件配置
├── README.md                                  # 项目说明文档
├── docker/                                    # Docker相关配置
│   ├── Dockerfile.service                     # 微服务通用Dockerfile
│   ├── docker-compose.yml                     # 完整系统编排文件
│   ├── docker-compose.dev.yml                 # 开发环境编排文件
│   └── docker-compose.prod.yml                # 生产环境编排文件
├── k8s/                                       # Kubernetes部署配置
│   ├── base/                                  # Kustomize基础配置
│   │   ├── namespace.yaml                     # 命名空间定义
│   │   ├── api-gateway/                       # API网关部署配置
│   │   ├── financial-service/                 # 财务服务部署配置
│   │   ├── controlling-service/               # 管理会计服务部署配置
│   │   ├── materials-service/                 # 物料服务部署配置
│   │   ├── sales-service/                     # 销售服务部署配置
│   │   ├── production-service/                # 生产服务部署配置
│   │   ├── hr-service/                        # 人力资源服务部署配置
│   │   ├── quality-service/                   # 质量管理服务部署配置
│   │   ├── maintenance-service/               # 设备维护服务部署配置
│   │   ├── crm-service/                       # 客户关系服务部署配置
│   │   ├── project-service/                   # 项目管理服务部署配置
│   │   ├── scm-service/                       # 供应链服务部署配置
│   │   ├── treasury-service/                  # 资金管理服务部署配置
│   │   ├── warehouse-service/                 # 仓库服务部署配置
│   │   ├── shipping-service/                  # 运输服务部署配置
│   │   └── analytics-service/                 # 分析服务部署配置
│   ├── overlays/                              # Kustomize环境覆盖配置
│   │   ├── dev/                               # 开发环境配置
│   │   ├── staging/                           # 预发环境配置
│   │   └── production/                        # 生产环境配置
│   └── helm/                                  # Helm Charts
│       └── erp-system/                        # ERP系统Helm Chart
│           ├── Chart.yaml                     # Chart元数据
│           ├── values.yaml                    # 默认配置值
│           ├── values-dev.yaml                # 开发环境配置值
│           ├── values-staging.yaml            # 预发环境配置值
│           ├── values-production.yaml         # 生产环境配置值
│           └── templates/                     # Kubernetes模板文件
├── proto/                                     # gRPC协议定义文件
│   ├── common/                                # 通用协议
│   │   └── v1/                                # v1版本
│   │       ├── error.proto                    # 错误定义
│   │       ├── pagination.proto               # 分页定义
│   │       └── metadata.proto                 # 元数据定义
│   ├── financial/                             # 财务服务协议
│   │   └── v1/
│   │       ├── financial_service.proto        # 财务服务主接口
│   │       ├── general_ledger.proto           # 总账协议
│   │       ├── accounts_payable.proto         # 应付账款协议
│   │       ├── accounts_receivable.proto      # 应收账款协议
│   │       └── asset_accounting.proto         # 资产会计协议
│   ├── controlling/                           # 管理会计服务协议
│   │   └── v1/
│   │       ├── controlling_service.proto      # 管理会计服务主接口
│   │       ├── cost_center.proto              # 成本中心协议
│   │       └── profitability.proto            # 盈利能力分析协议
│   ├── materials/                             # 物料服务协议
│   │   └── v1/
│   │       ├── materials_service.proto        # 物料服务主接口
│   │       ├── purchasing.proto               # 采购协议
│   │       ├── inventory.proto                # 库存协议
│   │       └── invoice_verification.proto     # 发票校验协议
│   ├── sales/                                 # 销售服务协议
│   │   └── v1/
│   │       ├── sales_service.proto            # 销售服务主接口
│   │       ├── order.proto                    # 订单协议
│   │       ├── shipping.proto                 # 发货协议
│   │       └── billing.proto                  # 计费协议
│   ├── production/                            # 生产服务协议
│   │   └── v1/
│   │       ├── production_service.proto       # 生产服务主接口
│   │       ├── planning.proto                 # 生产计划协议
│   │       └── shop_floor.proto               # 车间控制协议
│   ├── hr/                                    # 人力资源服务协议
│   │   └── v1/
│   │       ├── hr_service.proto               # 人力资源服务主接口
│   │       ├── personnel.proto                # 人事协议
│   │       ├── payroll.proto                  # 工资协议
│   │       └── time_management.proto          # 时间管理协议
│   ├── quality/                               # 质量管理服务协议
│   │   └── v1/
│   │       └── quality_service.proto          # 质量服务主接口
│   ├── maintenance/                           # 设备维护服务协议
│   │   └── v1/
│   │       └── maintenance_service.proto      # 维护服务主接口
│   ├── crm/                                   # 客户关系服务协议
│   │   └── v1/
│   │       └── crm_service.proto              # CRM服务主接口
│   ├── project/                               # 项目管理服务协议
│   │   └── v1/
│   │       └── project_service.proto          # 项目服务主接口
│   ├── scm/                                   # 供应链服务协议
│   │   └── v1/
│   │       └── scm_service.proto              # 供应链服务主接口
│   ├── treasury/                              # 资金管理服务协议
│   │   └── v1/
│   │       └── treasury_service.proto         # 资金服务主接口
│   ├── warehouse/                             # 仓库服务协议
│   │   └── v1/
│   │       └── warehouse_service.proto        # 仓库服务主接口
│   ├── shipping/                              # 运输服务协议
│   │   └── v1/
│   │       └── shipping_service.proto         # 运输服务主接口
│   └── analytics/                             # 分析服务协议
│       └── v1/
│           └── analytics_service.proto        # 分析服务主接口
├── shared/                                    # 共享库目录
│   ├── domain-primitives/                     # 领域原语库
│   │   ├── Cargo.toml                         # 包配置
│   │   └── src/
│   │       ├── lib.rs                         # 库入口
│   │       ├── money.rs                       # 货币值对象
│   │       ├── currency.rs                    # 货币类型
│   │       ├── email.rs                       # 邮箱值对象
│   │       ├── phone_number.rs                # 电话号码值对象
│   │       ├── address.rs                     # 地址值对象
│   │       ├── uuid_wrapper.rs                # UUID包装器
│   │       ├── quantity.rs                    # 数量值对象
│   │       ├── percentage.rs                  # 百分比值对象
│   │       ├── date_range.rs                  # 日期范围值对象
│   │       └── entity_id.rs                   # 实体ID值对象
│   ├── event-sourcing/                        # 事件溯源框架库
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs                         # 库入口
│   │       ├── event.rs                       # 事件trait定义
│   │       ├── event_store.rs                 # 事件存储接口
│   │       ├── aggregate.rs                   # 聚合根trait
│   │       ├── snapshot.rs                    # 快照功能
│   │       └── projection.rs                  # 事件投影
│   ├── cqrs/                                  # CQRS框架库
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs                         # 库入口
│   │       ├── command.rs                     # 命令trait定义
│   │       ├── command_handler.rs             # 命令处理器
│   │       ├── query.rs                       # 查询trait定义
│   │       ├── query_handler.rs               # 查询处理器
│   │       └── bus.rs                         # 消息总线
│   ├── observability/                         # 可观测性库
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs                         # 库入口
│   │       ├── tracing.rs                     # 分布式追踪
│   │       ├── metrics.rs                     # 指标采集
│   │       ├── logging.rs                     # 日志记录
│   │       └── correlation_id.rs              # 关联ID生成
│   ├── messaging/                             # 消息传递库
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs                         # 库入口
│   │       ├── kafka/                         # Kafka集成
│   │       │   ├── mod.rs
│   │       │   ├── producer.rs                # 生产者封装
│   │       │   └── consumer.rs                # 消费者封装
│   │       └── event_bus.rs                   # 事件总线抽象
│   ├── auth/                                  # 认证授权库
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs                         # 库入口
│   │       ├── jwt.rs                         # JWT认证
│   │       ├── oauth.rs                       # OAuth2.0
│   │       ├── rbac.rs                        # 基于角色的访问控制
│   │       └── permissions.rs                 # 权限管理
│   └── api-contracts/                         # API契约库
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs                         # 库入口
│           ├── request.rs                     # 请求基类
│           ├── response.rs                    # 响应基类
│           ├── error.rs                       # 错误定义
│           └── pagination.rs                  # 分页定义
├── services/                                  # 微服务目录
│   ├── financial-service/                     # 财务服务（对应KILLER FI模块）
│   │   ├── Cargo.toml                         # 服务依赖配置
│   │   ├── src/
│   │   │   ├── main.rs                        # 服务入口
│   │   │   ├── config.rs                      # 配置加载
│   │   │   ├── api/                           # API接口层
│   │   │   │   ├── mod.rs
│   │   │   │   ├── rest/                      # REST API
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── routes.rs              # 路由定义
│   │   │   │   │   ├── handlers/              # HTTP处理器
│   │   │   │   │   │   ├── mod.rs
│   │   │   │   │   │   ├── general_ledger_handler.rs      # 总账处理器
│   │   │   │   │   │   ├── accounts_payable_handler.rs    # 应付账款处理器
│   │   │   │   │   │   ├── accounts_receivable_handler.rs # 应收账款处理器
│   │   │   │   │   │   └── asset_accounting_handler.rs    # 资产会计处理器
│   │   │   │   │   └── dto/                   # 数据传输对象
│   │   │   │   │       ├── mod.rs
│   │   │   │   │       ├── gl_dto.rs          # 总账DTO
│   │   │   │   │       ├── ap_dto.rs          # 应付账款DTO
│   │   │   │   │       ├── ar_dto.rs          # 应收账款DTO
│   │   │   │   │       └── aa_dto.rs          # 资产会计DTO
│   │   │   │   └── grpc/                      # gRPC接口
│   │   │   │       ├── mod.rs
│   │   │   │       └── financial_service_impl.rs # gRPC服务实现
│   │   │   ├── application/                   # 应用层（CQRS）
│   │   │   │   ├── mod.rs
│   │   │   │   ├── commands/                  # 命令（写操作）
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── gl/                    # 总账命令
│   │   │   │   │   │   ├── mod.rs
│   │   │   │   │   │   ├── create_journal_entry.rs   # 创建凭证
│   │   │   │   │   │   ├── post_journal_entry.rs     # 过账凭证
│   │   │   │   │   │   └── reverse_entry.rs          # 冲销凭证
│   │   │   │   │   ├── ap/                    # 应付账款命令
│   │   │   │   │   │   ├── mod.rs
│   │   │   │   │   │   ├── create_invoice.rs         # 创建发票
│   │   │   │   │   │   ├── process_payment.rs        # 处理付款
│   │   │   │   │   │   └── create_credit_memo.rs     # 创建贷项凭证
│   │   │   │   │   ├── ar/                    # 应收账款命令
│   │   │   │   │   │   ├── mod.rs
│   │   │   │   │   │   ├── create_customer_invoice.rs # 创建客户发票
│   │   │   │   │   │   ├── record_payment.rs          # 记录收款
│   │   │   │   │   │   └── dunning.rs                 # 催款处理
│   │   │   │   │   └── aa/                    # 资产会计命令
│   │   │   │   │       ├── mod.rs
│   │   │   │   │       ├── acquire_asset.rs           # 资产购置
│   │   │   │   │       ├── depreciate_asset.rs        # 资产折旧
│   │   │   │   │       └── retire_asset.rs            # 资产报废
│   │   │   │   ├── queries/                   # 查询（读操作）
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── gl/                    # 总账查询
│   │   │   │   │   │   ├── mod.rs
│   │   │   │   │   │   ├── get_trial_balance.rs      # 获取试算表
│   │   │   │   │   │   ├── get_account_balance.rs    # 获取科目余额
│   │   │   │   │   │   └── get_journal_entries.rs    # 获取凭证列表
│   │   │   │   │   ├── ap/                    # 应付账款查询
│   │   │   │   │   │   ├── mod.rs
│   │   │   │   │   │   ├── get_open_items.rs         # 获取未清项
│   │   │   │   │   │   └── get_vendor_ledger.rs      # 获取供应商分类账
│   │   │   │   │   ├── ar/                    # 应收账款查询
│   │   │   │   │   │   ├── mod.rs
│   │   │   │   │   │   ├── get_aging_report.rs       # 获取账龄分析
│   │   │   │   │   │   └── get_customer_ledger.rs    # 获取客户分类账
│   │   │   │   │   └── aa/                    # 资产会计查询
│   │   │   │   │       ├── mod.rs
│   │   │   │   │       └── get_asset_register.rs     # 获取资产登记簿
│   │   │   │   └── services/                  # 应用服务
│   │   │   │       ├── mod.rs
│   │   │   │       └── financial_application_service.rs # 财务应用服务
│   │   │   ├── domain/                        # 领域层（DDD核心）
│   │   │   │   ├── mod.rs
│   │   │   │   ├── aggregates/                # 聚合根
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── gl/                    # 总账聚合
│   │   │   │   │   │   ├── mod.rs
│   │   │   │   │   │   ├── journal_entry.rs          # 凭证聚合根
│   │   │   │   │   │   ├── account.rs                # 会计科目
│   │   │   │   │   │   └── fiscal_period.rs          # 会计期间
│   │   │   │   │   ├── ap/                    # 应付账款聚合
│   │   │   │   │   │   ├── mod.rs
│   │   │   │   │   │   ├── vendor_invoice.rs         # 供应商发票聚合根
│   │   │   │   │   │   ├── payment.rs                # 付款
│   │   │   │   │   │   └── vendor.rs                 # 供应商
│   │   │   │   │   ├── ar/                    # 应收账款聚合
│   │   │   │   │   │   ├── mod.rs
│   │   │   │   │   │   ├── customer_invoice.rs       # 客户发票聚合根
│   │   │   │   │   │   ├── customer_payment.rs       # 客户付款
│   │   │   │   │   │   └── customer.rs               # 客户
│   │   │   │   │   └── aa/                    # 资产会计聚合
│   │   │   │   │       ├── mod.rs
│   │   │   │   │       ├── asset.rs                  # 资产聚合根
│   │   │   │   │       └── depreciation.rs           # 折旧
│   │   │   │   ├── value_objects/             # 值对象
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── money.rs                      # 货币值对象
│   │   │   │   │   ├── account_number.rs             # 科目编号
│   │   │   │   │   ├── posting_key.rs                # 过账码
│   │   │   │   │   ├── document_number.rs            # 凭证号
│   │   │   │   │   └── tax_code.rs                   # 税码
│   │   │   │   ├── events/                    # 领域事件
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── gl_events.rs                  # 总账事件
│   │   │   │   │   ├── ap_events.rs                  # 应付账款事件
│   │   │   │   │   ├── ar_events.rs                  # 应收账款事件
│   │   │   │   │   └── aa_events.rs                  # 资产会计事件
│   │   │   │   ├── services/                  # 领域服务
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── posting_validator.rs          # 过账验证服务
│   │   │   │   │   ├── tax_calculator.rs             # 税金计算服务
│   │   │   │   │   └── exchange_rate_service.rs      # 汇率服务
│   │   │   │   └── repositories/              # 仓储接口（定义在领域层）
│   │   │   │       ├── mod.rs
│   │   │   │       ├── journal_entry_repository.rs   # 凭证仓储接口
│   │   │   │       ├── invoice_repository.rs         # 发票仓储接口
│   │   │   │       ├── payment_repository.rs         # 付款仓储接口
│   │   │   │       └── asset_repository.rs           # 资产仓储接口
│   │   │   └── infrastructure/                # 基础设施层
│   │   │       ├── mod.rs
│   │   │       ├── config.rs                         # 配置实现
│   │   │       ├── persistence/               # 持久化
│   │   │       │   ├── mod.rs
│   │   │       │   ├── postgres/              # PostgreSQL实现
│   │   │       │   │   ├── mod.rs
│   │   │       │   │   ├── models.rs                 # 数据库模型
│   │   │       │   │   ├── journal_entry_repository_impl.rs  # 凭证仓储实现
│   │   │       │   │   ├── invoice_repository_impl.rs        # 发票仓储实现
│   │   │       │   │   ├── payment_repository_impl.rs        # 付款仓储实现
│   │   │       │   │   └── asset_repository_impl.rs          # 资产仓储实现
│   │   │       │   └── redis/                 # Redis缓存
│   │   │       │       ├── mod.rs
│   │   │       │       └── cache.rs                  # 缓存实现
│   │   │       └── messaging/                 # 消息传递
│   │   │           ├── mod.rs
│   │   │           ├── kafka_producer.rs             # Kafka生产者
│   │   │           └── kafka_consumer.rs             # Kafka消费者
│   │   ├── migrations/                        # 数据库迁移脚本
│   │   │   ├── 20250101000000_create_gl_tables.sql           # 创建总账表
│   │   │   ├── 20250101000001_create_ap_tables.sql           # 创建应付账款表
│   │   │   ├── 20250101000002_create_ar_tables.sql           # 创建应收账款表
│   │   │   └── 20250101000003_create_aa_tables.sql           # 创建资产会计表
│   │   └── tests/                             # 测试目录
│   │       ├── integration/                   # 集成测试
│   │       │   ├── mod.rs
│   │       │   ├── gl_tests.rs                       # 总账集成测试
│   │       │   ├── ap_tests.rs                       # 应付账款集成测试
│   │       │   ├── ar_tests.rs                       # 应收账款集成测试
│   │       │   └── aa_tests.rs                       # 资产会计集成测试
│   │       └── unit/                          # 单元测试
│   │           ├── mod.rs
│   │           └── domain/                    # 领域层单元测试
│   │               ├── mod.rs
│   │               └── aggregates/
│   │
│   ├── controlling-service/                   # 管理会计服务（对应KILLER CO模块）
│   │   ├── Cargo.toml
│   │   ├── src/
│   │   │   ├── main.rs                        # 服务入口
│   │   │   ├── config.rs                      # 配置加载
│   │   │   ├── api/                           # API接口层
│   │   │   │   ├── mod.rs
│   │   │   │   ├── rest/                      # REST API
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── routes.rs              # 路由定义
│   │   │   │   │   ├── handlers/              # HTTP处理器
│   │   │   │   │   │   ├── mod.rs
│   │   │   │   │   │   ├── cost_center_handler.rs           # 成本中心处理器
│   │   │   │   │   │   ├── internal_order_handler.rs        # 内部订单处理器
│   │   │   │   │   │   ├── product_costing_handler.rs       # 产品成本处理器
│   │   │   │   │   │   └── profitability_handler.rs         # 盈利能力分析处理器
│   │   │   │   │   └── dto/                   # 数据传输对象
│   │   │   │   │       ├── mod.rs
│   │   │   │   │       └── controlling_dto.rs        # 管理会计DTO
│   │   │   │   └── grpc/                      # gRPC接口
│   │   │   │       ├── mod.rs
│   │   │   │       └── controlling_service_impl.rs   # gRPC服务实现
│   │   │   ├── application/                   # 应用层
│   │   │   │   ├── mod.rs
│   │   │   │   ├── commands/                  # 命令
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── cost_center/           # 成本中心命令
│   │   │   │   │   ├── internal_order/        # 内部订单命令
│   │   │   │   │   ├── product_costing/       # 产品成本命令
│   │   │   │   │   └── profitability/         # 盈利能力分析命令
│   │   │   │   ├── queries/                   # 查询
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── cost_center/           # 成本中心查询
│   │   │   │   │   ├── internal_order/        # 内部订单查询
│   │   │   │   │   ├── product_costing/       # 产品成本查询
│   │   │   │   │   └── profitability/         # 盈利能力分析查询
│   │   │   │   └── services/                  # 应用服务
│   │   │   │       ├── mod.rs
│   │   │   │       └── controlling_application_service.rs # 管理会计应用服务
│   │   │   ├── domain/                        # 领域层
│   │   │   │   ├── mod.rs
│   │   │   │   ├── aggregates/                # 聚合根
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── cost_center.rs                # 成本中心聚合根
│   │   │   │   │   ├── internal_order.rs             # 内部订单聚合根
│   │   │   │   │   ├── product_cost.rs               # 产品成本聚合根
│   │   │   │   │   └── profit_center.rs              # 利润中心聚合根
│   │   │   │   ├── value_objects/             # 值对象
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── cost_element.rs               # 成本要素
│   │   │   │   │   └── activity_type.rs              # 作业类型
│   │   │   │   ├── events/                    # 领域事件
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   └── controlling_events.rs         # 管理会计事件
│   │   │   │   ├── services/                  # 领域服务
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── cost_allocation_service.rs    # 成本分配服务
│   │   │   │   │   └── variance_calculator.rs        # 差异计算服务
│   │   │   │   └── repositories/              # 仓储接口
│   │   │   │       ├── mod.rs
│   │   │   │       ├── cost_center_repository.rs     # 成本中心仓储
│   │   │   │       └── internal_order_repository.rs  # 内部订单仓储
│   │   │   └── infrastructure/                # 基础设施层
│   │   │       ├── mod.rs
│   │   │       ├── config.rs
│   │   │       ├── persistence/               # 持久化
│   │   │       │   ├── mod.rs
│   │   │       │   ├── postgres/              # PostgreSQL实现
│   │   │       │   │   ├── mod.rs
│   │   │       │   │   ├── models.rs                 # 数据库模型
│   │   │       │   │   └── repository_impl.rs        # 仓储实现
│   │   │       │   └── redis/                 # Redis缓存
│   │   │       │       ├── mod.rs
│   │   │       │       └── cache.rs
│   │   │       └── messaging/                 # 消息传递
│   │   │           ├── mod.rs
│   │   │           ├── kafka_producer.rs
│   │   │           └── kafka_consumer.rs
│   │   ├── migrations/                        # 数据库迁移
│   │   │   ├── 20250101000000_create_controlling_tables.sql  # 创建管理会计表
│   │   │   └── 20250101000001_create_cost_center_tables.sql  # 创建成本中心表
│   │   └── tests/                             # 测试
│   │       ├── integration/                   # 集成测试
│   │       └── unit/                          # 单元测试
│   │
│   ├── materials-service/                     # 物料服务（对应KILLER MM模块）
│   │   ├── Cargo.toml
│   │   ├── src/
│   │   │   ├── main.rs
│   │   │   ├── config.rs
│   │   │   ├── api/                           # API接口层
│   │   │   │   ├── mod.rs
│   │   │   │   ├── rest/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── routes.rs
│   │   │   │   │   ├── handlers/
│   │   │   │   │   │   ├── mod.rs
│   │   │   │   │   │   ├── purchasing_handler.rs            # 采购处理器
│   │   │   │   │   │   ├── inventory_handler.rs             # 库存处理器
│   │   │   │   │   │   └── invoice_verification_handler.rs  # 发票校验处理器
│   │   │   │   │   └── dto/
│   │   │   │   │       ├── mod.rs
│   │   │   │   │       └── materials_dto.rs          # 物料DTO
│   │   │   │   └── grpc/
│   │   │   │       ├── mod.rs
│   │   │   │       └── materials_service_impl.rs
│   │   │   ├── application/                   # 应用层
│   │   │   │   ├── mod.rs
│   │   │   │   ├── commands/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── purchasing/            # 采购命令
│   │   │   │   │   │   ├── mod.rs
│   │   │   │   │   │   ├── create_purchase_order.rs         # 创建采购订单
│   │   │   │   │   │   ├── create_rfq.rs                    # 创建询价
│   │   │   │   │   │   └── create_contract.rs               # 创建合同
│   │   │   │   │   ├── inventory/             # 库存命令
│   │   │   │   │   │   ├── mod.rs
│   │   │   │   │   │   ├── goods_receipt.rs                 # 收货
│   │   │   │   │   │   ├── goods_issue.rs                   # 发货
│   │   │   │   │   │   ├── stock_transfer.rs                # 库存转储
│   │   │   │   │   │   └── physical_inventory.rs            # 实地盘点
│   │   │   │   │   └── invoice/               # 发票命令
│   │   │   │   │       ├── mod.rs
│   │   │   │   │       └── verify_invoice.rs                # 校验发票
│   │   │   │   ├── queries/                   # 查询
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── purchasing/            # 采购查询
│   │   │   │   │   ├── inventory/             # 库存查询
│   │   │   │   │   └── invoice/               # 发票查询
│   │   │   │   └── services/
│   │   │   │       ├── mod.rs
│   │   │   │       └── materials_application_service.rs
│   │   │   ├── domain/                        # 领域层
│   │   │   │   ├── mod.rs
│   │   │   │   ├── aggregates/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── purchasing/            # 采购聚合
│   │   │   │   │   │   ├── mod.rs
│   │   │   │   │   │   ├── purchase_order.rs                # 采购订单聚合根
│   │   │   │   │   │   ├── rfq.rs                           # 询价聚合根
│   │   │   │   │   │   ├── contract.rs                      # 合同聚合根
│   │   │   │   │   │   └── vendor.rs                        # 供应商
│   │   │   │   │   ├── inventory/             # 库存聚合
│   │   │   │   │   │   ├── mod.rs
│   │   │   │   │   │   ├── material.rs                      # 物料聚合根
│   │   │   │   │   │   ├── stock.rs                         # 库存
│   │   │   │   │   │   ├── warehouse.rs                     # 仓库
│   │   │   │   │   │   └── storage_location.rs              # 存储地点
│   │   │   │   │   └── invoice/               # 发票聚合
│   │   │   │   │       ├── mod.rs
│   │   │   │   │       └── invoice_verification.rs          # 发票校验聚合根
│   │   │   │   ├── value_objects/             # 值对象
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── sku.rs                               # SKU编码
│   │   │   │   │   ├── quantity.rs                          # 数量
│   │   │   │   │   ├── unit_of_measure.rs                   # 计量单位
│   │   │   │   │   └── vendor_code.rs                       # 供应商代码
│   │   │   │   ├── events/                    # 领域事件
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── purchasing_events.rs                 # 采购事件
│   │   │   │   │   ├── inventory_events.rs                  # 库存事件
│   │   │   │   │   └── invoice_events.rs                    # 发票事件
│   │   │   │   ├── services/                  # 领域服务
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── stock_allocator.rs                   # 库存分配服务
│   │   │   │   │   ├── reorder_service.rs                   # 再订货服务
│   │   │   │   │   └── price_validator.rs                   # 价格验证服务
│   │   │   │   └── repositories/              # 仓储接口
│   │   │   │       ├── mod.rs
│   │   │   │       ├── purchase_order_repository.rs         # 采购订单仓储
│   │   │   │       ├── material_repository.rs               # 物料仓储
│   │   │   │       └── stock_repository.rs                  # 库存仓储
│   │   │   └── infrastructure/                # 基础设施层
│   │   │       ├── mod.rs
│   │   │       ├── config.rs
│   │   │       ├── persistence/
│   │   │       │   ├── mod.rs
│   │   │       │   ├── postgres/
│   │   │       │   │   ├── mod.rs
│   │   │       │   │   ├── models.rs
│   │   │       │   │   └── repository_impl.rs
│   │   │       │   └── redis/
│   │   │       │       ├── mod.rs
│   │   │       │       └── cache.rs
│   │   │       └── messaging/
│   │   │           ├── mod.rs
│   │   │           ├── kafka_producer.rs
│   │   │           └── kafka_consumer.rs
│   │   ├── migrations/
│   │   │   ├── 20250101000000_create_materials_tables.sql   # 创建物料表
│   │   │   ├── 20250101000001_create_purchasing_tables.sql  # 创建采购表
│   │   │   └── 20250101000002_create_inventory_tables.sql   # 创建库存表
│   │   └── tests/
│   │       ├── integration/
│   │       └── unit/
│   │
│   ├── sales-service/                         # 销售服务（对应KILLER SD模块）
│   │   ├── Cargo.toml
│   │   ├── src/
│   │   │   ├── main.rs
│   │   │   ├── config.rs
│   │   │   ├── api/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── rest/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── routes.rs
│   │   │   │   │   ├── handlers/
│   │   │   │   │   │   ├── sales_order_handler.rs
│   │   │   │   │   │   ├── delivery_handler.rs
│   │   │   │   │   │   └── billing_handler.rs
│   │   │   │   │   └── dto/
│   │   │   │   │       ├── sales_order_dto.rs
│   │   │   │   │       ├── delivery_dto.rs
│   │   │   │   │       └── billing_dto.rs
│   │   │   │   └── grpc/
│   │   │   │       ├── mod.rs
│   │   │   │       └── sales_service_impl.rs
│   │   │   ├── application/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── commands/
│   │   │   │   │   ├── create_sales_order.rs
│   │   │   │   │   ├── confirm_delivery.rs
│   │   │   │   │   └── issue_credit_memo.rs
│   │   │   │   ├── queries/
│   │   │   │   │   ├── list_open_orders.rs
│   │   │   │   │   ├── track_delivery.rs
│   │   │   │   │   └── billing_report.rs
│   │   │   │   └── services/
│   │   │   │       ├── mod.rs
│   │   │   │       └── sales_application_service.rs
│   │   │   ├── domain/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── aggregates/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── sales_order.rs
│   │   │   │   │   ├── delivery.rs
│   │   │   │   │   └── billing_record.rs
│   │   │   │   ├── value_objects/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── pricing.rs
│   │   │   │   │   └── contract.rs
│   │   │   │   ├── events/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   └── sales_events.rs
│   │   │   │   ├── services/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── pricing_service.rs
│   │   │   │   │   └── route_planning_service.rs
│   │   │   │   └── repositories/
│   │   │   │       ├── mod.rs
│   │   │   │       ├── sales_order_repository.rs
│   │   │   │       └── delivery_repository.rs
│   │   │   └── infrastructure/
│   │   │       ├── mod.rs
│   │   │       ├── config.rs
│   │   │       ├── persistence/
│   │   │       │   ├── mod.rs
│   │   │       │   ├── postgres/
│   │   │       │   │   ├── mod.rs
│   │   │       │   │   ├── models.rs
│   │   │       │   │   ├── order_repository_impl.rs
│   │   │       │   │   └── delivery_repository_impl.rs
│   │   │       │   └── redis/
│   │   │       │       ├── mod.rs
│   │   │       │       └── cache.rs
│   │   │       └── messaging/
│   │   │           ├── mod.rs
│   │   │           ├── kafka_producer.rs
│   │   │           └── kafka_consumer.rs
│   │   ├── migrations/
│   │   │   ├── 20250101000000_create_sales_tables.sql
│   │   └── tests/
│   │       ├── integration/
│   │       └── unit/
│   │
│   ├── production-service/                    # 生产服务（对应KILLER PP模块）
│   │   ├── Cargo.toml
│   │   ├── src/
│   │   │   ├── main.rs
│   │   │   ├── config.rs
│   │   │   ├── api/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── rest/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── routes.rs
│   │   │   │   │   ├── handlers/
│   │   │   │   │   │   ├── production_plan_handler.rs
│   │   │   │   │   │   ├── mrp_handler.rs
│   │   │   │   │   │   └── shop_floor_handler.rs
│   │   │   │   │   └── dto/
│   │   │   │   │       ├── production_plan_dto.rs
│   │   │   │   │       ├── mrp_run_dto.rs
│   │   │   │   │       └── shop_floor_dto.rs
│   │   │   │   └── grpc/
│   │   │   │       ├── mod.rs
│   │   │   │       └── production_service_impl.rs
│   │   │   ├── application/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── commands/
│   │   │   │   │   ├── create_production_plan.rs
│   │   │   │   │   ├── run_mrp_cycle.rs
│   │   │   │   │   └── release_production_order.rs
│   │   │   │   ├── queries/
│   │   │   │   │   ├── get_production_plan.rs
│   │   │   │   │   ├── get_capacity_status.rs
│   │   │   │   │   └── get_work_orders.rs
│   │   │   │   └── services/
│   │   │   │       ├── mod.rs
│   │   │   │       └── production_application_service.rs
│   │   │   ├── domain/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── aggregates/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── production_plan.rs
│   │   │   │   │   ├── work_order.rs
│   │   │   │   │   └── mrp_run.rs
│   │   │   │   ├── value_objects/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── resource_requirement.rs
│   │   │   │   │   └── operation.rs
│   │   │   │   ├── events/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   └── production_events.rs
│   │   │   │   ├── services/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── plan_service.rs
│   │   │   │   │   └── capacity_service.rs
│   │   │   │   └── repositories/
│   │   │   │       ├── mod.rs
│   │   │   │       ├── production_order_repository.rs
│   │   │   │       └── mrp_repository.rs
│   │   │   └── infrastructure/
│   │   │       ├── mod.rs
│   │   │       ├── config.rs
│   │   │       ├── persistence/
│   │   │       │   ├── mod.rs
│   │   │       │   ├── postgres/
│   │   │       │   │   ├── mod.rs
│   │   │       │   │   ├── models.rs
│   │   │       │   │   ├── production_repository_impl.rs
│   │   │       │   │   └── mrp_repository_impl.rs
│   │   │       │   └── redis/
│   │   │       │       ├── mod.rs
│   │   │       │       └── cache.rs
│   │   │       └── messaging/
│   │   │           ├── mod.rs
│   │   │           ├── kafka_producer.rs
│   │   │           └── kafka_consumer.rs
│   │   ├── migrations/
│   │   │   ├── 20250101000000_create_production_tables.sql
│   │   └── tests/
│   │       ├── integration/
│   │       └── unit/
│   │
│   ├── hr-service/                            # 人力资源服务（对应KILLER HR模块）
│   │   ├── Cargo.toml
│   │   ├── src/
│   │   │   ├── main.rs
│   │   │   ├── config.rs
│   │   │   ├── api/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── rest/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── routes.rs
│   │   │   │   │   ├── handlers/
│   │   │   │   │   │   ├── personnel_handler.rs
│   │   │   │   │   │   ├── payroll_handler.rs
│   │   │   │   │   │   └── time_off_handler.rs
│   │   │   │   │   └── dto/
│   │   │   │   │       ├── employee_dto.rs
│   │   │   │   │       ├── payroll_dto.rs
│   │   │   │   │       └── attendance_dto.rs
│   │   │   │   └── grpc/
│   │   │   │       ├── mod.rs
│   │   │   │       └── hr_service_impl.rs
│   │   │   ├── application/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── commands/
│   │   │   │   │   ├── hire_employee.rs
│   │   │   │   │   ├── run_payroll.rs
│   │   │   │   │   └── approve_time_off.rs
│   │   │   │   ├── queries/
│   │   │   │   │   ├── get_employee_profile.rs
│   │   │   │   │   ├── get_payroll_cycle.rs
│   │   │   │   │   └── attendance_report.rs
│   │   │   │   └── services/
│   │   │   │       ├── mod.rs
│   │   │   │       └── hr_application_service.rs
│   │   │   ├── domain/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── aggregates/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── employee.rs
│   │   │   │   │   ├── payroll_cycle.rs
│   │   │   │   │   └── absence_record.rs
│   │   │   │   ├── value_objects/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── employment_type.rs
│   │   │   │   │   └── benefit_package.rs
│   │   │   │   ├── events/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   └── hr_events.rs
│   │   │   │   ├── services/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── payroll_service.rs
│   │   │   │   │   └── time_off_service.rs
│   │   │   │   └── repositories/
│   │   │   │       ├── mod.rs
│   │   │   │       ├── employee_repository.rs
│   │   │   │       └── payroll_repository.rs
│   │   │   └── infrastructure/
│   │   │       ├── mod.rs
│   │   │       ├── config.rs
│   │   │       ├── persistence/
│   │   │       │   ├── mod.rs
│   │   │       │   ├── postgres/
│   │   │       │   │   ├── mod.rs
│   │   │       │   │   ├── models.rs
│   │   │       │   │   ├── employee_repository_impl.rs
│   │   │       │   │   └── payroll_repository_impl.rs
│   │   │       │   └── redis/
│   │   │       │       ├── mod.rs
│   │   │       │       └── cache.rs
│   │   │       └── messaging/
│   │   │           ├── mod.rs
│   │   │           ├── kafka_producer.rs
│   │   │           └── kafka_consumer.rs
│   │   ├── migrations/
│   │   │   ├── 20250101000000_create_hr_tables.sql
│   │   └── tests/
│   │       ├── integration/
│   │       └── unit/
│   │
│   ├── quality-service/                       # 质量管理服务（对应KILLER QM模块）
│   │   ├── Cargo.toml
│   │   ├── src/
│   │   │   ├── main.rs
│   │   │   ├── config.rs
│   │   │   ├── api/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── rest/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── routes.rs
│   │   │   │   │   ├── handlers/
│   │   │   │   │   │   ├── inspection_handler.rs
│   │   │   │   │   │   ├── notification_handler.rs
│   │   │   │   │   │   └── nonconformance_handler.rs
│   │   │   │   │   └── dto/
│   │   │   │   │       ├── inspection_dto.rs
│   │   │   │   │       ├── quality_notification_dto.rs
│   │   │   │   │       └── ncr_dto.rs
│   │   │   │   └── grpc/
│   │   │   │       ├── mod.rs
│   │   │   │       └── quality_service_impl.rs
│   │   │   ├── application/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── commands/
│   │   │   │   │   ├── schedule_inspection.rs
│   │   │   │   │   ├── record_inspection_result.rs
│   │   │   │   │   └── issue_ncr.rs
│   │   │   │   ├── queries/
│   │   │   │   │   ├── get_inspection_plan.rs
│   │   │   │   │   ├── get_quality_trends.rs
│   │   │   │   │   └── get_nonconformance.rs
│   │   │   │   └── services/
│   │   │   │       ├── mod.rs
│   │   │   │       └── quality_application_service.rs
│   │   │   ├── domain/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── aggregates/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── inspection_plan.rs
│   │   │   │   │   ├── inspection_result.rs
│   │   │   │   │   └── quality_notification.rs
│   │   │   │   ├── value_objects/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── sampling_plan.rs
│   │   │   │   │   └── defect_code.rs
│   │   │   │   ├── events/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   └── quality_events.rs
│   │   │   │   ├── services/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── sampling_service.rs
│   │   │   │   │   └── nonconformance_service.rs
│   │   │   │   └── repositories/
│   │   │   │       ├── mod.rs
│   │   │   │       ├── inspection_repository.rs
│   │   │   │       └── notification_repository.rs
│   │   │   └── infrastructure/
│   │   │       ├── mod.rs
│   │   │       ├── config.rs
│   │   │       ├── persistence/
│   │   │       │   ├── mod.rs
│   │   │       │   ├── postgres/
│   │   │       │   │   ├── mod.rs
│   │   │       │   │   ├── models.rs
│   │   │       │   │   ├── inspection_repository_impl.rs
│   │   │       │   │   └── notification_repository_impl.rs
│   │   │       │   └── redis/
│   │   │       │       ├── mod.rs
│   │   │       │       └── cache.rs
│   │   │       └── messaging/
│   │   │           ├── mod.rs
│   │   │           ├── kafka_producer.rs
│   │   │           └── kafka_consumer.rs
│   │   ├── migrations/
│   │   │   ├── 20250101000000_create_quality_tables.sql
│   │   └── tests/
│   │       ├── integration/
│   │       └── unit/
│   │
│   ├── maintenance-service/                   # 设备维护服务（对应KILLER PM模块）
│   │   ├── Cargo.toml
│   │   ├── src/
│   │   │   ├── main.rs
│   │   │   ├── config.rs
│   │   │   ├── api/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── rest/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── routes.rs
│   │   │   │   │   ├── handlers/
│   │   │   │   │   │   ├── equipment_handler.rs
│   │   │   │   │   │   ├── work_order_handler.rs
│   │   │   │   │   │   └── maintenance_schedule_handler.rs
│   │   │   │   │   └── dto/
│   │   │   │   │       ├── equipment_dto.rs
│   │   │   │   │       ├── work_order_dto.rs
│   │   │   │   │       └── schedule_dto.rs
│   │   │   │   └── grpc/
│   │   │   │       ├── mod.rs
│   │   │   │       └── maintenance_service_impl.rs
│   │   │   ├── application/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── commands/
│   │   │   │   │   ├── register_equipment.rs
│   │   │   │   │   ├── create_work_order.rs
│   │   │   │   │   └── plan_preventive_maintenance.rs
│   │   │   │   ├── queries/
│   │   │   │   │   ├── get_equipment_status.rs
│   │   │   │   │   ├── list_work_orders.rs
│   │   │   │   │   └── maintenance_schedule.rs
│   │   │   │   └── services/
│   │   │   │       ├── mod.rs
│   │   │   │       └── maintenance_application_service.rs
│   │   │   ├── domain/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── aggregates/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── equipment.rs
│   │   │   │   │   ├── work_order.rs
│   │   │   │   │   └── maintenance_schedule.rs
│   │   │   │   ├── value_objects/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── equipment_type.rs
│   │   │   │   │   └── maintenance_frequency.rs
│   │   │   │   ├── events/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   └── maintenance_events.rs
│   │   │   │   ├── services/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── work_order_service.rs
│   │   │   │   │   └── preventive_service.rs
│   │   │   │   └── repositories/
│   │   │   │       ├── mod.rs
│   │   │   │       ├── equipment_repository.rs
│   │   │   │       └── work_order_repository.rs
│   │   │   └── infrastructure/
│   │   │       ├── mod.rs
│   │   │       ├── config.rs
│   │   │       ├── persistence/
│   │   │       │   ├── mod.rs
│   │   │       │   ├── postgres/
│   │   │       │   │   ├── mod.rs
│   │   │       │   │   ├── models.rs
│   │   │       │   │   ├── equipment_repository_impl.rs
│   │   │       │   │   └── work_order_repository_impl.rs
│   │   │       │   └── redis/
│   │   │       │       ├── mod.rs
│   │   │       │       └── cache.rs
│   │   │       └── messaging/
│   │   │           ├── mod.rs
│   │   │           ├── kafka_producer.rs
│   │   │           └── kafka_consumer.rs
│   │   ├── migrations/
│   │   │   ├── 20250101000000_create_maintenance_tables.sql
│   │   └── tests/
│   │       ├── integration/
│   │       └── unit/
│   │
│   ├── crm-service/                           # 客户关系服务（对应KILLER CRM模块）
│   │   ├── Cargo.toml
│   │   ├── src/
│   │   │   ├── main.rs
│   │   │   ├── config.rs
│   │   │   ├── api/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── rest/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── routes.rs
│   │   │   │   │   ├── handlers/
│   │   │   │   │   │   ├── lead_handler.rs
│   │   │   │   │   │   ├── account_handler.rs
│   │   │   │   │   │   └── activity_handler.rs
│   │   │   │   │   └── dto/
│   │   │   │   │       ├── lead_dto.rs
│   │   │   │   │       ├── account_dto.rs
│   │   │   │   │       └── activity_dto.rs
│   │   │   │   └── grpc/
│   │   │   │       ├── mod.rs
│   │   │   │       └── crm_service_impl.rs
│   │   │   ├── application/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── commands/
│   │   │   │   │   ├── create_lead.rs
│   │   │   │   │   ├── convert_lead.rs
│   │   │   │   │   └── log_activity.rs
│   │   │   │   ├── queries/
│   │   │   │   │   ├── get_lead_pipeline.rs
│   │   │   │   │   ├── get_account_summary.rs
│   │   │   │   │   └── get_activity_trail.rs
│   │   │   │   └── services/
│   │   │   │       ├── mod.rs
│   │   │   │       └── crm_application_service.rs
│   │   │   ├── domain/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── aggregates/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── lead.rs
│   │   │   │   │   ├── customer_account.rs
│   │   │   │   │   └── activity.rs
│   │   │   │   ├── value_objects/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── relationship_strength.rs
│   │   │   │   │   └── lead_score.rs
│   │   │   │   ├── events/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   └── crm_events.rs
│   │   │   │   ├── services/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── lead_scoring_service.rs
│   │   │   │   │   └── activity_service.rs
│   │   │   │   └── repositories/
│   │   │   │       ├── mod.rs
│   │   │   │       ├── lead_repository.rs
│   │   │   │       └── account_repository.rs
│   │   │   └── infrastructure/
│   │   │       ├── mod.rs
│   │   │       ├── config.rs
│   │   │       ├── persistence/
│   │   │       │   ├── mod.rs
│   │   │       │   ├── postgres/
│   │   │       │   │   ├── mod.rs
│   │   │       │   │   ├── models.rs
│   │   │       │   │   ├── lead_repository_impl.rs
│   │   │       │   │   └── account_repository_impl.rs
│   │   │       │   └── redis/
│   │   │       │       ├── mod.rs
│   │   │       │       └── cache.rs
│   │   │       └── messaging/
│   │   │           ├── mod.rs
│   │   │           ├── kafka_producer.rs
│   │   │           └── kafka_consumer.rs
│   │   ├── migrations/
│   │   │   ├── 20250101000000_create_crm_tables.sql
│   │   └── tests/
│   │       ├── integration/
│   │       └── unit/
│   │
│   ├── project-service/                       # 项目管理服务（对应KILLER PS模块）
│   │   ├── Cargo.toml
│   │   ├── src/
│   │   │   ├── main.rs
│   │   │   ├── config.rs
│   │   │   ├── api/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── rest/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── routes.rs
│   │   │   │   │   ├── handlers/
│   │   │   │   │   │   ├── project_handler.rs
│   │   │   │   │   │   ├── wbs_handler.rs
│   │   │   │   │   │   └── network_handler.rs
│   │   │   │   │   └── dto/
│   │   │   │   │       ├── project_dto.rs
│   │   │   │   │       ├── wbs_dto.rs
│   │   │   │   │       └── network_dto.rs
│   │   │   │   └── grpc/
│   │   │   │       ├── mod.rs
│   │   │   │       └── project_service_impl.rs
│   │   │   ├── application/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── commands/
│   │   │   │   │   ├── create_project.rs
│   │   │   │   │   ├── update_wbs.rs
│   │   │   │   │   └── schedule_network.rs
│   │   │   │   ├── queries/
│   │   │   │   │   ├── get_project_status.rs
│   │   │   │   │   ├── get_cost_plan.rs
│   │   │   │   │   └── get_network_view.rs
│   │   │   │   └── services/
│   │   │   │       ├── mod.rs
│   │   │   │       └── project_application_service.rs
│   │   │   ├── domain/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── aggregates/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── project.rs
│   │   │   │   │   ├── wbs_element.rs
│   │   │   │   │   └── network_schedule.rs
│   │   │   │   ├── value_objects/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── milestone.rs
│   │   │   │   │   └── cost_account.rs
│   │   │   │   ├── events/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   └── project_events.rs
│   │   │   │   ├── services/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   └── project_control_service.rs
│   │   │   │   └── repositories/
│   │   │   │       ├── mod.rs
│   │   │   │       ├── project_repository.rs
│   │   │   │       └── wbs_repository.rs
│   │   │   └── infrastructure/
│   │   │       ├── mod.rs
│   │   │       ├── config.rs
│   │   │       ├── persistence/
│   │   │       │   ├── mod.rs
│   │   │       │   ├── postgres/
│   │   │       │   │   ├── mod.rs
│   │   │       │   │   ├── models.rs
│   │   │       │   │   ├── project_repository_impl.rs
│   │   │       │   │   └── wbs_repository_impl.rs
│   │   │       │   └── redis/
│   │   │       │       ├── mod.rs
│   │   │       │       └── cache.rs
│   │   │       └── messaging/
│   │   │           ├── mod.rs
│   │   │           ├── kafka_producer.rs
│   │   │           └── kafka_consumer.rs
│   │   ├── migrations/
│   │   │   ├── 20250101000000_create_project_tables.sql
│   │   └── tests/
│   │       ├── integration/
│   │       └── unit/
│   │
│   ├── scm-service/                           # 供应链服务（对应KILLER SCM模块）
│   │   ├── Cargo.toml
│   │   ├── src/
│   │   │   ├── main.rs
│   │   │   ├── config.rs
│   │   │   ├── api/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── rest/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── routes.rs
│   │   │   │   │   ├── handlers/
│   │   │   │   │   │   ├── demand_handler.rs
│   │   │   │   │   │   ├── supply_handler.rs
│   │   │   │   │   │   └── supplier_handler.rs
│   │   │   │   │   └── dto/
│   │   │   │   │       ├── demand_plan_dto.rs
│   │   │   │   │       ├── supply_plan_dto.rs
│   │   │   │   │       └── collaboration_dto.rs
│   │   │   │   └── grpc/
│   │   │   │       ├── mod.rs
│   │   │   │       └── scm_service_impl.rs
│   │   │   ├── application/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── commands/
│   │   │   │   │   ├── create_demand_plan.rs
│   │   │   │   │   ├── allocate_supply.rs
│   │   │   │   │   └── start_supplier_collaboration.rs
│   │   │   │   ├── queries/
│   │   │   │   │   ├── get_demand_forecast.rs
│   │   │   │   │   ├── get_supply_status.rs
│   │   │   │   │   └── get_supplier_performance.rs
│   │   │   │   └── services/
│   │   │   │       ├── mod.rs
│   │   │   │       ├── supply_planning_service.rs
│   │   │   │       └── collaboration_service.rs
│   │   │   ├── domain/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── aggregates/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── demand_plan.rs
│   │   │   │   │   ├── supply_plan.rs
│   │   │   │   │   └── supplier_collaboration.rs
│   │   │   │   ├── value_objects/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── forecast.rs
│   │   │   │   │   └── lead_time.rs
│   │   │   │   ├── events/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   └── scm_events.rs
│   │   │   │   ├── services/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── demand_planner_service.rs
│   │   │   │   │   └── collaboration_service.rs
│   │   │   │   └── repositories/
│   │   │   │       ├── mod.rs
│   │   │   │       ├── demand_repository.rs
│   │   │   │       └── supply_repository.rs
│   │   │   └── infrastructure/
│   │   │       ├── mod.rs
│   │   │       ├── config.rs
│   │   │       ├── persistence/
│   │   │       │   ├── mod.rs
│   │   │       │   ├── postgres/
│   │   │       │   │   ├── mod.rs
│   │   │       │   │   ├── models.rs
│   │   │       │   │   ├── demand_repository_impl.rs
│   │   │       │   │   └── supply_repository_impl.rs
│   │   │       │   └── redis/
│   │   │       │       ├── mod.rs
│   │   │       │       └── cache.rs
│   │   │       └── messaging/
│   │   │           ├── mod.rs
│   │   │           ├── kafka_producer.rs
│   │   │           └── kafka_consumer.rs
│   │   ├── migrations/
│   │   │   ├── 20250101000000_create_scm_tables.sql
│   │   └── tests/
│   │       ├── integration/
│   │       └── unit/
│   │
│   ├── treasury-service/                      # 资金管理服务（对应KILLER TR模块）
│   │   ├── Cargo.toml
│   │   ├── src/
│   │   │   ├── main.rs
│   │   │   ├── config.rs
│   │   │   ├── api/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── rest/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── routes.rs
│   │   │   │   │   ├── handlers/
│   │   │   │   │   │   ├── cash_handler.rs
│   │   │   │   │   │   ├── payment_handler.rs
│   │   │   │   │   │   └── risk_handler.rs
│   │   │   │   │   └── dto/
│   │   │   │   │       ├── cash_position_dto.rs
│   │   │   │   │       ├── payment_batch_dto.rs
│   │   │   │   │       └── risk_dto.rs
│   │   │   │   └── grpc/
│   │   │   │       ├── mod.rs
│   │   │   │       └── treasury_service_impl.rs
│   │   │   ├── application/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── commands/
│   │   │   │   │   ├── record_cash_position.rs
│   │   │   │   │   ├── execute_payment.rs
│   │   │   │   │   └── hedge_risk.rs
│   │   │   │   ├── queries/
│   │   │   │   │   ├── cash_overview.rs
│   │   │   │   │   ├── payment_queue.rs
│   │   │   │   │   └── risk_dashboard.rs
│   │   │   │   └── services/
│   │   │   │       ├── mod.rs
│   │   │   │       ├── cash_management_service.rs
│   │   │   │       └── fx_service.rs
│   │   │   ├── domain/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── aggregates/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── cash_position.rs
│   │   │   │   │   ├── payment_batch.rs
│   │   │   │   │   └── risk_limit.rs
│   │   │   │   ├── value_objects/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── fx_rate.rs
│   │   │   │   │   └── risk_category.rs
│   │   │   │   ├── events/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   └── treasury_events.rs
│   │   │   │   ├── services/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── cash_repository.rs
│   │   │   │   │   └── fx_service.rs
│   │   │   │   └── repositories/
│   │   │   │       ├── mod.rs
│   │   │   │       ├── cash_repository.rs
│   │   │   │       └── payment_repository.rs
│   │   │   └── infrastructure/
│   │   │       ├── mod.rs
│   │   │       ├── config.rs
│   │   │       ├── persistence/
│   │   │       │   ├── mod.rs
│   │   │       │   ├── postgres/
│   │   │       │   │   ├── mod.rs
│   │   │       │   │   ├── models.rs
│   │   │       │   │   ├── cash_repository_impl.rs
│   │   │       │   │   └── payment_repository_impl.rs
│   │   │       │   └── redis/
│   │   │       │       ├── mod.rs
│   │   │       │       └── cache.rs
│   │   │       └── messaging/
│   │   │           ├── mod.rs
│   │   │           ├── kafka_producer.rs
│   │   │           └── kafka_consumer.rs
│   │   ├── migrations/
│   │   │   ├── 20250101000000_create_treasury_tables.sql
│   │   └── tests/
│   │       ├── integration/
│   │       └── unit/
│   │
│   ├── warehouse-service/                     # 仓库服务（对应KILLER WM/EWM模块）
│   │   ├── Cargo.toml
│   │   ├── src/
│   │   │   ├── main.rs
│   │   │   ├── config.rs
│   │   │   ├── api/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── rest/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── routes.rs
│   │   │   │   │   ├── handlers/
│   │   │   │   │   │   ├── inbound_handler.rs
│   │   │   │   │   │   ├── outbound_handler.rs
│   │   │   │   │   │   └── inventory_handler.rs
│   │   │   │   │   └── dto/
│   │   │   │   │       ├── inbound_dto.rs
│   │   │   │   │       ├── outbound_dto.rs
│   │   │   │   │       └── inventory_dto.rs
│   │   │   │   └── grpc/
│   │   │   │       ├── mod.rs
│   │   │   │       └── warehouse_service_impl.rs
│   │   │   ├── application/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── commands/
│   │   │   │   │   ├── receive_goods.rs
│   │   │   │   │   ├── dispatch_goods.rs
│   │   │   │   │   └── adjust_inventory.rs
│   │   │   │   ├── queries/
│   │   │   │   │   ├── inventory_snapshot.rs
│   │   │   │   │   ├── slotting_recommendations.rs
│   │   │   │   │   └── storage_occupancy.rs
│   │   │   │   └── services/
│   │   │   │       ├── mod.rs
│   │   │   │       ├── slotting_service.rs
│   │   │   │       └── material_flow_service.rs
│   │   │   ├── domain/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── aggregates/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── warehouse.rs
│   │   │   │   │   ├── storage_location.rs
│   │   │   │   │   └── slotting_plan.rs
│   │   │   │   ├── value_objects/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── bin.rs
│   │   │   │   │   └── material_flow.rs
│   │   │   │   ├── events/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   └── warehouse_events.rs
│   │   │   │   ├── services/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── slotting_service.rs
│   │   │   │   │   └── material_flow_service.rs
│   │   │   │   └── repositories/
│   │   │   │       ├── mod.rs
│   │   │   │       ├── warehouse_repository.rs
│   │   │   │       └── inventory_repository.rs
│   │   │   └── infrastructure/
│   │   │       ├── mod.rs
│   │   │       ├── config.rs
│   │   │       ├── persistence/
│   │   │       │   ├── mod.rs
│   │   │       │   ├── postgres/
│   │   │       │   │   ├── mod.rs
│   │   │       │   │   ├── models.rs
│   │   │       │   │   ├── warehouse_repository_impl.rs
│   │   │       │   │   └── inventory_repository_impl.rs
│   │   │       │   └── redis/
│   │   │       │       ├── mod.rs
│   │   │       │       └── cache.rs
│   │   │       └── messaging/
│   │   │           ├── mod.rs
│   │   │           ├── kafka_producer.rs
│   │   │           └── kafka_consumer.rs
│   │   ├── migrations/
│   │   │   ├── 20250101000000_create_warehouse_tables.sql
│   │   └── tests/
│   │       ├── integration/
│   │       └── unit/
│   │
│   ├── shipping-service/                      # 运输服务（对应KILLER TM模块）
│   │   ├── Cargo.toml
│   │   ├── src/
│   │   │   ├── main.rs
│   │   │   ├── config.rs
│   │   │   ├── api/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── rest/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── routes.rs
│   │   │   │   │   ├── handlers/
│   │   │   │   │   │   ├── shipment_handler.rs
│   │   │   │   │   │   ├── carrier_handler.rs
│   │   │   │   │   │   └── tracking_handler.rs
│   │   │   │   │   └── dto/
│   │   │   │   │       ├── shipment_dto.rs
│   │   │   │   │       ├── carrier_dto.rs
│   │   │   │   │       └── tracking_dto.rs
│   │   │   │   └── grpc/
│   │   │   │       ├── mod.rs
│   │   │   │       └── shipping_service_impl.rs
│   │   │   ├── application/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── commands/
│   │   │   │   │   ├── create_shipment.rs
│   │   │   │   │   ├── book_carrier.rs
│   │   │   │   │   └── update_tracking.rs
│   │   │   │   ├── queries/
│   │   │   │   │   ├── shipment_status.rs
│   │   │   │   │   ├── carrier_performance.rs
│   │   │   │   │   └── route_adherence.rs
│   │   │   │   └── services/
│   │   │   │       ├── mod.rs
│   │   │   │       └── shipping_application_service.rs
│   │   │   ├── domain/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── aggregates/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── shipment.rs
│   │   │   │   │   ├── carrier_booking.rs
│   │   │   │   │   └── route.rs
│   │   │   │   ├── value_objects/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── route_segment.rs
│   │   │   │   │   └── shipment_dimension.rs
│   │   │   │   ├── events/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   └── shipping_events.rs
│   │   │   │   ├── services/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   └── route_optimizer_service.rs
│   │   │   │   └── repositories/
│   │   │   │       ├── mod.rs
│   │   │   │       ├── shipment_repository.rs
│   │   │   │       └── carrier_repository.rs
│   │   │   └── infrastructure/
│   │   │       ├── mod.rs
│   │   │       ├── config.rs
│   │   │       ├── persistence/
│   │   │       │   ├── mod.rs
│   │   │       │   ├── postgres/
│   │   │       │   │   ├── mod.rs
│   │   │       │   │   ├── models.rs
│   │   │       │   │   ├── shipment_repository_impl.rs
│   │   │       │   │   └── carrier_repository_impl.rs
│   │   │       │   └── redis/
│   │   │       │       ├── mod.rs
│   │   │       │       └── cache.rs
│   │   │       └── messaging/
│   │   │           ├── mod.rs
│   │   │           ├── kafka_producer.rs
│   │   │           └── kafka_consumer.rs
│   │   ├── migrations/
│   │   │   ├── 20250101000000_create_shipping_tables.sql
│   │   └── tests/
│   │       ├── integration/
│   │       └── unit/
│   │
│   ├── analytics-service/                     # 分析服务（对应KILLER BW/BI模块）
│   │   ├── Cargo.toml
│   │   ├── src/
│   │   │   ├── main.rs
│   │   │   ├── config.rs
│   │   │   ├── api/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── rest/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── routes.rs
│   │   │   │   │   ├── handlers/
│   │   │   │   │   │   ├── report_handler.rs
│   │   │   │   │   │   ├── dashboard_handler.rs
│   │   │   │   │   │   └── alert_handler.rs
│   │   │   │   │   └── dto/
│   │   │   │   │       ├── report_dto.rs
│   │   │   │   │       ├── dashboard_dto.rs
│   │   │   │   │       └── alert_dto.rs
│   │   │   │   └── grpc/
│   │   │   │       ├── mod.rs
│   │   │   │       └── analytics_service_impl.rs
│   │   │   ├── application/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── commands/
│   │   │   │   │   ├── refresh_dashboard.rs
│   │   │   │   │   ├── promote_report.rs
│   │   │   │   │   └── schedule_alert.rs
│   │   │   │   ├── queries/
│   │   │   │   │   ├── query_metrics.rs
│   │   │   │   │   ├── get_dashboard_state.rs
│   │   │   │   │   └── get_alert_history.rs
│   │   │   │   └── services/
│   │   │   │       ├── mod.rs
│   │   │   │       ├── report_service.rs
│   │   │   │       └── etl_service.rs
│   │   │   ├── domain/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── aggregates/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── report.rs
│   │   │   │   │   ├── dashboard.rs
│   │   │   │   │   └── metric.rs
│   │   │   │   ├── value_objects/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── kpi.rs
│   │   │   │   │   └── threshold.rs
│   │   │   │   ├── events/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   └── analytics_events.rs
│   │   │   │   ├── services/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── report_service.rs
│   │   │   │   │   └── etl_service.rs
│   │   │   │   └── repositories/
│   │   │   │       ├── mod.rs
│   │   │   │       ├── clickhouse_repository.rs
│   │   │   │       └── metrics_repository.rs
│   │   │   └── infrastructure/
│   │   │       ├── mod.rs
│   │   │       ├── config.rs
│   │   │       ├── persistence/
│   │   │       │   ├── mod.rs
│   │   │       │   ├── clickhouse/
│   │   │       │   │   ├── mod.rs
│   │   │       │   │   ├── models.rs
│   │   │       │   │   ├── clickhouse_repository_impl.rs
│   │   │       │   │   └── ingestion.rs
│   │   │       │   └── redis/
│   │   │       │       ├── mod.rs
│   │   │       │       └── cache.rs
│   │   │       └── messaging/
│   │   │           ├── mod.rs
│   │   │           ├── kafka_producer.rs
│   │   │           └── kafka_consumer.rs
│   │   │   ├── etl/
│   │   │   │   ├── ingestion.rs
│   │   │   │   └── transformer.rs
│   │   ├── migrations/
│   │   │   ├── 20250101000000_create_analytics_tables.sql
│   │   ├── tests/
│   │   │   ├── integration/
│   │   │   └── unit/
│   │
│   └── api-gateway/                           # API网关
│       ├── Cargo.toml
│       ├── src/
│       │   ├── main.rs                        # 网关入口
│       │   ├── config.rs                      # 配置
│       │   ├── middleware/                    # 中间件
│       │   │   ├── mod.rs
│       │   │   ├── auth.rs                    # 认证中间件
│       │   │   ├── rate_limit.rs              # 限流中间件
│       │   │   ├── cors.rs                    # CORS中间件
│       │   │   └── logging.rs                 # 日志中间件
│       │   ├── routes/                        # 路由
│       │   │   ├── mod.rs
│       │   │   └── proxy.rs                   # 反向代理
│       │   └── health.rs                      # 健康检查
│       └── tests/
│           └── integration/                   # 集成测试
│
├── infrastructure/                            # 基础设施配置
│   ├── kafka/                                 # Kafka配置
│   │   ├── docker-compose.yml                 # Kafka Docker编排
│   │   └── config/                            # Kafka配置文件
│   ├── postgres/                              # PostgreSQL配置
│   │   ├── docker-compose.yml                 # PostgreSQL Docker编排
│   │   └── init/                              # 初始化脚本
│   ├── redis/                                 # Redis配置
│   │   └── docker-compose.yml                 # Redis Docker编排
│   ├── monitoring/                            # 监控配置
│   │   ├── prometheus/                        # Prometheus配置
│   │   │   ├── prometheus.yml                 # Prometheus主配置
│   │   │   └── alerts/                        # 告警规则
│   │   ├── grafana/                           # Grafana配置
│   │   │   ├── dashboards/                    # 仪表盘定义
│   │   │   └── datasources/                   # 数据源配置
│   │   ├── loki/                              # Loki日志聚合
│   │   │   └── config.yml                     # Loki配置
│   │   └── jaeger/                            # Jaeger追踪
│   │       └── config.yml                     # Jaeger配置
│   └── scripts/                               # 运维脚本
│       ├── setup.sh                           # 环境初始化脚本
│       ├── deploy.sh                          # 部署脚本
│       └── backup.sh                          # 备份脚本
│
├── docs/                                      # 文档目录
│   ├── architecture/                          # 架构文档
│   │   ├── system-design.md                   # 系统设计文档
│   │   ├── domain-model.md                    # 领域模型文档
│   │   └── api-design.md                      # API设计文档
│   ├── deployment/                            # 部署文档
│   │   ├── local-setup.md                     # 本地环境搭建
│   │   ├── kubernetes-deployment.md           # K8s部署指南
│   │   └── production-checklist.md            # 生产检查清单
│   └── development/                           # 开发文档
│       ├── coding-standards.md                # 编码规范
│       ├── testing-guide.md                   # 测试指南
│       └── contribution-guide.md              # 贡献指南
│
└── tools/                                     # 开发工具
    ├── cli/                                   # 命令行工具
    │   ├── Cargo.toml
    │   └── src/
    │       └── main.rs                        # CLI工具入口
    ├── migration-tool/                        # 数据库迁移工具
    │   ├── Cargo.toml
    │   └── src/
    │       └── main.rs                        # 迁移工具入口
    └── load-testing/                          # 负载测试工具
        ├── Cargo.toml
        └── scenarios/                         # 测试场景定义
```


**版本**: v1.0
**创建日期**: 2025-12-21
**维护者**: ERP开发团队
