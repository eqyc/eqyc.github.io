# Rust ERP 系统 - 5人团队12个月开发计划（增强版）

**基于**: Rust-Abc.md + Rust-BOM.md 完整融合
**版本**: v2.0 Enhanced
**创建日期**: 2025-12-22
**说明**: 本文档在原有 12 个月计划基础上，整合 BOM 非 MVP 版本的完整业务能力、验收标准和最佳实践

---

## 文档导航

- **Rust-Abc.md**: 原始 12 个月计划（按天拆分的详细任务）
- **Rust-BOM.md**: 完整 KILLER 替代清单（15 个波次的业务能力）
- **本文档**: 融合版计划，补充缺失模块和验收标准

---

## 一、增强后的开发阶段划分（12个月）

```
阶段 0（Month 1 Week 1-2）  | 平台与主数据治理基线（新增）
阶段 1（Month 1-2）        | 基础设施建设与共享库开发（原有）
阶段 2（Month 3-5）        | 财务会计 FI + 资金管理 TR/FSCM（增强）
阶段 3（Month 3-5）        | 管理会计 CO（原有）
阶段 4（Month 6-8）        | 物料与采购 MM + 销售与分销 SD + 生产计划 PP（原有）
阶段 5（Month 9-10）       | 仓储 WM/EWM + 运输 TM + 质量 QM + 设备维护 PM（原有）
阶段 6（Month 9-10）       | 人力资本 HCM + 客户关系 CRM（原有）
阶段 7（Month 10）         | 供应链计划 SCM/IBP（新增）
阶段 8（Month 10）         | 项目系统 PS（新增）
阶段 9（Month 11）         | 分析与报表 BI/BW（增强）
阶段 10（Month 11-12）     | 集成测试、性能优化、上线准备（原有）
```

---

## 二、阶段 0：平台与主数据治理（新增）

### 时间：Month 1 Week 1-2（Day 1-10）

### 目标
在基础设施搭建的同时，建立主数据治理和平台能力基线，为所有后续模块提供统一的主数据服务、身份认证和审计能力。

### Week 1（Day 1-5）：主数据治理服务启动

#### Day 1-2: Master Data Governance Service 项目初始化
**开发者A（领导）+ 全员协助**

- **创建 mdg-service 项目结构**
  ```
  services/mdg-service/
  ├── domain/
  │   ├── aggregates/
  │   │   ├── business_partner.rs     # 业务伙伴聚合根（客户/供应商）
  │   │   ├── material_master.rs      # 物料主数据聚合根
  │   │   ├── chart_of_accounts.rs    # 科目表聚合根
  │   │   └── organization.rs         # 组织架构聚合根
  │   ├── value_objects/
  │   │   ├── partner_number.rs       # 业务伙伴编号
  │   │   ├── material_number.rs      # 物料编号
  │   │   ├── account_number.rs       # 科目编号
  │   │   └── org_unit_id.rs          # 组织单元编号
  │   ├── services/
  │   │   ├── duplicate_check_service.rs    # 重复检测服务
  │   │   ├── data_quality_service.rs       # 数据质量服务
  │   │   └── change_management_service.rs  # 变更管理服务
  │   └── events/
  │       ├── business_partner_events.rs
  │       ├── material_events.rs
  │       └── organization_events.rs
  ```

- **主数据建模**（开发者A + B）
  - 业务伙伴（BP）模型：客户/供应商统一主数据
  - 物料主数据模型：SKU、计量单位、物料类型
  - 科目表模型：会计科目、成本要素、利润中心
  - 组织架构模型：公司代码、工厂、库存地点、成本中心

#### Day 3-4: 主数据版本管理与审批流
**开发者A + B**

- **版本控制**
  - `domain/aggregates/master_data_version.rs`: 主数据版本聚合根
  - 支持：草稿版本、审批中、已激活、已失效
  - 生效日期/失效日期控制
  - 变更历史追溯

- **审批工作流**
  - `domain/services/approval_workflow_service.rs`: 审批流服务
  - `application/commands/submit_for_approval.rs`: 提交审批
  - `application/commands/approve_master_data.rs`: 审批主数据
  - `application/commands/reject_master_data.rs`: 拒绝变更

- **数据质量规则**
  - `domain/services/data_quality_rules.rs`
  - 唯一性检查：业务伙伴编号、物料编号
  - 完整性检查：必填字段验证
  - 一致性检查：跨字段逻辑校验
  - 准确性检查：格式、范围验证

#### Day 5: 重复检测与合并
**开发者A + E**

- **重复检测算法**
  - `domain/services/duplicate_detection_service.rs`
  - 模糊匹配：业务伙伴名称、地址
  - 相似度评分：Levenshtein 距离
  - 疑似重复记录标记

- **主数据合并**
  - `application/commands/merge_business_partners.rs`
  - 合并策略：保留主记录、归档重复记录
  - 关联数据自动更新（外键重定向）

### Week 2（Day 6-10）：身份与访问管理（IAM）

#### Day 6-7: 统一身份服务
**开发者E（领导）+ A 协助**

- **创建 iam-service 项目**
  ```
  services/iam-service/
  ├── domain/
  │   ├── aggregates/
  │   │   ├── user.rs              # 用户聚合根
  │   │   ├── role.rs              # 角色聚合根
  │   │   ├── permission.rs        # 权限聚合根
  │   │   └── session.rs           # 会话聚合根
  │   ├── services/
  │   │   ├── authentication_service.rs     # 认证服务
  │   │   ├── authorization_service.rs      # 授权服务
  │   │   └── sod_check_service.rs          # 职责分离检查服务
  ```

- **认证实现**
  - OIDC/OAuth2 集成（Keycloak）
  - JWT Token 签发与验证
  - 单点登录（SSO）
  - 多因素认证（MFA）支持

#### Day 8-9: 授权与权限模型
**开发者E + A**

- **RBAC（基于角色的访问控制）**
  - `domain/aggregates/role.rs`: 角色定义（财务会计、采购员、仓库管理员等）
  - `domain/aggregates/permission.rs`: 权限粒度（创建、读取、更新、删除、审批）
  - 用户-角色-权限映射

- **ABAC（基于属性的访问控制）**
  - 属性策略：组织维度（公司代码、工厂）、数据维度（成本中心、利润中心）
  - 动态权限计算：用户属性 + 资源属性 + 环境属性

- **职责分离（SoD）**
  - `domain/services/sod_check_service.rs`
  - 冲突规则定义：采购订单创建者不能审批、出纳不能记账
  - 角色分配时 SoD 预检查
  - 实时 SoD 违规告警

#### Day 10: 审计追踪基线
**开发者D + E**

- **审计日志服务**
  ```
  services/audit-service/
  ├── domain/
  │   ├── aggregates/
  │   │   └── audit_log.rs         # 审计日志聚合根
  │   └── value_objects/
  │       ├── audit_event.rs       # 审计事件
  │       └── audit_metadata.rs    # 审计元数据
  ```

- **审计能力**
  - 所有写操作（创建、更新、删除）记录审计日志
  - 审计字段：操作人、操作时间、操作类型、IP 地址、设备信息
  - 数据变更前后快照（JSON Diff）
  - 审计日志不可篡改（Append-Only）

- **审计日志存储**
  - PostgreSQL 审计表（时间序列分区）
  - ClickHouse 长期归档（WORM 存储）
  - 留存策略：热数据 3 个月、温数据 1 年、冷数据 7 年

### 验收标准（阶段 0）

#### 功能验收
- [ ] 业务伙伴主数据 CRUD + 版本管理 + 审批流
- [ ] 物料主数据 CRUD + 重复检测 + 合并
- [ ] 科目表主数据 CRUD + 数据质量规则
- [ ] 组织架构主数据 CRUD + 层级关系管理
- [ ] OIDC/OAuth2 认证集成（Keycloak）
- [ ] RBAC/ABAC 授权模型实现
- [ ] SoD 冲突检查服务
- [ ] 审计日志记录所有主数据变更

#### 数据质量验收
- [ ] 唯一性检查：业务伙伴编号、物料编号 100% 唯一
- [ ] 完整性检查：必填字段覆盖率 > 95%
- [ ] 重复检测准确率 > 90%（人工抽样验证）
- [ ] 数据质量评分机制上线（唯一性、完整性、一致性、准确性）

#### 集成验收
- [ ] 主数据变更事件发布到 Kafka（erp.mdg.business_partner.created 等）
- [ ] 下游服务订阅主数据事件（FI、MM、SD、HR 缓存更新）
- [ ] 幂等与重放验证通过
- [ ] 主数据缓存一致性策略验证（Redis Write-Through）

#### 安全与合规验收
- [ ] SSO 登录流程验证
- [ ] 权限模型渗透测试（越权访问验证）
- [ ] SoD 冲突规则测试（采购+审批、出纳+记账）
- [ ] 审计日志完整性测试（所有变更可追溯）
- [ ] 加密密钥管理验证（Vault 集成）

#### 性能验收
- [ ] 主数据查询 P99 < 50ms（Redis 缓存命中率 > 90%）
- [ ] 主数据创建 P99 < 150ms
- [ ] 重复检测批处理：1000 条记录 < 30 秒
- [ ] 审计日志写入延迟 < 10ms（异步写入）

---

## 三、阶段 2 增强：财务会计 FI + 资金管理 TR/FSCM

### Month 3-5 原有计划补充

在原有 Financial Service（FI-GL/AR/AP/AA）基础上，增加资金与财务供应链模块。

### Month 4 Week 2（Day 46-50）：Treasury Service - TR 基础

#### Day 46-48: 现金管理与流动性计划
**开发者B（领导）**

- **创建 treasury-service 项目**
  ```
  services/treasury-service/
  ├── domain/
  │   ├── aggregates/
  │   │   ├── cash_pool.rs              # 现金池聚合根
  │   │   ├── liquidity_forecast.rs     # 流动性预测聚合根
  │   │   ├── bank_statement.rs         # 银行对账单聚合根
  │   │   └── payment_factory.rs        # 付款工厂聚合根
  │   ├── services/
  │   │   ├── cash_positioning_service.rs    # 现金头寸服务
  │   │   ├── liquidity_planning_service.rs  # 流动性计划服务
  │   │   └── bank_reconciliation_service.rs # 银行对账服务
  ```

- **现金池与资金集中**
  - `domain/aggregates/cash_pool.rs`
  - 支持：虚拟现金池、实际现金池
  - 头寸管理：实时现金头寸、预测头寸
  - 资金归集策略：零余额账户、目标余额账户

- **流动性预测**
  - `domain/services/liquidity_planning_service.rs`
  - 基于历史数据的滚动预测（7 天、30 天、90 天）
  - 应收/应付预测集成（来自 FI-AR/AP）
  - 流动性缺口告警

#### Day 49-50: 交易管理（外汇与利率）
**开发者B**

- **外汇交易**
  - `domain/aggregates/fx_deal.rs`: 外汇交易聚合根
  - `domain/services/fx_valuation_service.rs`: 外汇估值服务
  - 支持：即期交易、远期交易、掉期交易
  - 市场数据集成（汇率源）

- **利率管理**
  - `domain/aggregates/interest_rate_swap.rs`: 利率互换聚合根
  - `domain/services/hedge_accounting_service.rs`: 套期会计服务
  - 支持：普通利率互换（IRS）、交叉货币互换（CCS）

### Month 5 Week 1（Day 51-55）：财务供应链 FSCM

#### Day 51-53: 信用管理（FSCM-CR）
**开发者B**

- **创建 credit-management-service 项目**
  ```
  services/credit-management-service/
  ├── domain/
  │   ├── aggregates/
  │   │   ├── credit_limit.rs           # 信用额度聚合根
  │   │   ├── credit_exposure.rs        # 信用暴露聚合根
  │   │   └── credit_block.rs           # 信用冻结聚合根
  │   ├── services/
  │   │   ├── credit_scoring_service.rs      # 信用评分服务
  │   │   ├── credit_check_service.rs        # 信用检查服务
  │   │   └── credit_release_service.rs      # 信用放行服务
  ```

- **信用额度管理**
  - `domain/aggregates/credit_limit.rs`
  - 支持：客户级额度、信用控制区域级额度
  - 额度审批流程
  - 额度自动调整策略（基于支付历史）

- **信用检查**
  - `domain/services/credit_check_service.rs`
  - 实时信用检查（销售订单创建时）
  - 信用暴露计算：未清应收 + 未清订单
  - 信用冻结与放行工作流

- **信用评分**
  - `domain/services/credit_scoring_service.rs`
  - 评分模型：支付历史、账龄、订单履约率
  - 风险等级：AAA、AA、A、BBB、BB、B、CCC
  - 动态额度调整建议

#### Day 54-55: 催收管理（FSCM-CM）
**开发者B**

- **催收策略**
  - `domain/aggregates/collection_strategy.rs`: 催收策略聚合根
  - `domain/aggregates/dunning_run.rs`: 催款运行聚合根
  - 催收级别：友好提醒、正式催款、法律行动
  - 催收行动：邮件、电话、暂停发货、法律诉讼

- **催收工作列表**
  - `application/queries/collection_worklist.rs`
  - 按账龄、金额、客户风险等级排序
  - 催收任务自动分配（催收专员）

- **争议管理（FSCM-DM）**
  - `domain/aggregates/dispute_case.rs`: 争议案件聚合根
  - 争议类型：数量差异、质量问题、价格争议
  - 争议生命周期：创建、调查、协商、解决、关闭
  - 争议金额暂不收款处理

### 验收标准（TR/FSCM 增强）

#### 功能验收
- [ ] 现金池与头寸管理功能完整
- [ ] 流动性滚动预测（7/30/90 天）
- [ ] 银行对账自动化（对账单导入 + 匹配）
- [ ] 外汇交易生命周期管理（交易录入、估值、结算）
- [ ] 利率互换交易与套期会计
- [ ] 信用额度管理与审批流
- [ ] 实时信用检查（销售订单 → 信用冻结/放行）
- [ ] 信用评分与风险等级
- [ ] 催收策略与工作列表
- [ ] 争议案件管理闭环

#### 集成验收
- [ ] 与 FI-BL 共享银行账户与流水
- [ ] 与 FI-AR/AP 集成（应收应付数据同步）
- [ ] 与 Sales Service 集成（订单信用检查）
- [ ] 银行接口集成（Swift/银企直连模拟）
- [ ] 市场数据源集成（汇率/利率）

#### 报表验收
- [ ] 流动性滚动预测报表
- [ ] 现金流差异分析
- [ ] 信用暴露报表（按客户、区域、产品）
- [ ] DSO（Days Sales Outstanding）/ DPO（Days Payable Outstanding）
- [ ] 对冲效果评估报表

#### 风控与合规验证
- [ ] KYC/AML 钩子集成（Know Your Customer / Anti-Money Laundering）
- [ ] 交易审批与双人复核（maker-checker）
- [ ] 交易日志留存（7 年）
- [ ] 限额与授权控制（交易金额分级审批）

#### 性能验证
- [ ] 信用检查响应时间 P99 < 100ms（Redis 缓存信用额度）
- [ ] 流动性预测批处理 < 5 分钟（1000+ 交易）
- [ ] 银行对账批处理 < 10 分钟（10000+ 流水）

---

## 四、阶段 7 新增：供应链计划 SCM/IBP

### Month 10 Week 1-2（Day 191-200）：高级供应链计划

在原有 Production Service 基础 MRP 之上，增加高级供应链计划能力。

#### Day 191-195: 需求计划与预测
**开发者C（领导）+ A 协助**

- **创建 supply-chain-planning-service 项目**
  ```
  services/supply-chain-planning-service/
  ├── domain/
  │   ├── aggregates/
  │   │   ├── demand_plan.rs              # 需求计划聚合根
  │   │   ├── supply_plan.rs              # 供应计划聚合根
  │   │   ├── inventory_policy.rs         # 库存策略聚合根
  │   │   └── planning_scenario.rs        # 计划情景聚合根
  │   ├── services/
  │   │   ├── demand_forecasting_service.rs     # 需求预测服务
  │   │   ├── supply_planning_service.rs        # 供应计划服务
  │   │   ├── inventory_optimization_service.rs # 库存优化服务
  │   │   └── scenario_simulation_service.rs    # 情景模拟服务
  ```

- **需求预测**
  - `domain/services/demand_forecasting_service.rs`
  - 统计预测：移动平均、指数平滑、ARIMA
  - 因果预测：促销活动、季节性因素
  - 机器学习预测（可选）：XGBoost、LSTM
  - 预测层级：产品族、SKU、工厂、客户

- **需求协同**
  - `application/commands/collaborative_demand_planning.rs`
  - 销售与运营计划（S&OP）流程
  - 多方共识计划（销售、营销、供应链、财务）
  - 版本管理与冻结窗口

#### Day 196-198: 供应计划与库存优化
**开发者C**

- **约束型供应计划**
  - `domain/services/supply_planning_service.rs`
  - 约束识别：产能约束、物料约束、供应商约束
  - 计划策略：MTS（Make-to-Stock）、MTO（Make-to-Order）、ATO（Assemble-to-Order）
  - 分配与承诺（ATP/CTP）：可用量承诺、可生产量承诺

- **库存优化**
  - `domain/services/inventory_optimization_service.rs`
  - 安全库存计算：服务水平、需求变异性、补货周期
  - 再订货点（ROP）计算
  - 库存定位策略：多级库存、配送网络优化
  - 库存健康度评估：呆滞库存、过期库存、短缺风险

#### Day 199-200: 响应与重计划
**开发者C**

- **事件驱动重计划**
  - `domain/services/replanning_service.rs`
  - 触发事件：需求突增、供应中断、产能变化
  - 重计划策略：部分重计划、全量重计划
  - 计划稳定性 vs. 响应性权衡

- **情景模拟与假设分析**
  - `domain/aggregates/planning_scenario.rs`
  - 假设场景：需求 +20%、供应商停产、新工厂上线
  - 情景对比分析：成本、服务水平、库存周转
  - 最佳情景推荐

### 验收标准（SCM/IBP）

#### 功能验收
- [ ] 需求预测算法实现（至少 2 种：移动平均、指数平滑）
- [ ] 预测准确度评估（MAPE、Bias）
- [ ] 需求协同与版本管理
- [ ] 约束型供应计划（产能/物料约束识别）
- [ ] 安全库存与再订货点计算
- [ ] 库存优化建议（超储/缺货告警）
- [ ] 事件驱动重计划（需求突变、供应中断）
- [ ] 情景模拟与对比分析

#### 集成验证
- [ ] 与 Sales Service 集成（历史销售数据 → 需求预测）
- [ ] 与 Production Service 集成（产能数据 → 供应计划）
- [ ] 与 Materials Service 集成（库存数据 → 库存优化）
- [ ] 与 BI Service 集成（计划版本 → 数据仓库）

#### 报表验证
- [ ] 预测准确度报表（MAPE by SKU/Product Family）
- [ ] 计划履约率报表（计划 vs. 实际）
- [ ] 库存周转率报表
- [ ] 缺货率与超储率报表
- [ ] 计划偏差分析（需求/供应/库存）

#### 性能验证
- [ ] 预测计算批处理：10000 SKU < 30 分钟
- [ ] 供应计划运算：1000 工单 < 15 分钟
- [ ] 库存优化批处理：10000 SKU < 20 分钟
- [ ] 情景模拟响应时间 < 2 分钟

---

## 五、阶段 8 新增：项目系统 PS

### Month 10 Week 3-4（Day 201-210）：项目系统

#### Day 201-205: 项目结构与预算
**开发者E（领导）**

- **创建 project-system-service 项目**
  ```
  services/project-system-service/
  ├── domain/
  │   ├── aggregates/
  │   │   ├── project.rs               # 项目聚合根
  │   │   ├── wbs_element.rs           # WBS 元素聚合根
  │   │   ├── network_activity.rs      # 网络活动聚合根
  │   │   └── project_budget.rs        # 项目预算聚合根
  │   ├── services/
  │   │   ├── earned_value_service.rs         # 挣值分析服务
  │   │   ├── revenue_recognition_service.rs  # 收入确认服务
  │   │   └── change_management_service.rs    # 变更管理服务
  ```

- **WBS（工作分解结构）**
  - `domain/aggregates/wbs_element.rs`
  - WBS 层级结构：项目 → 阶段 → 任务 → 子任务
  - WBS 版本管理与基线
  - WBS 责任分配（项目经理、任务负责人）

- **网络计划**
  - `domain/aggregates/network_activity.rs`
  - 活动定义：活动编号、描述、持续时间
  - 活动关系：FS（Finish-to-Start）、SS（Start-to-Start）、FF、SF
  - 关键路径计算（CPM）
  - 里程碑管理

- **预算与承诺**
  - `domain/aggregates/project_budget.rs`
  - 预算分配：按 WBS 分配预算
  - 承诺管理：采购订单、生产订单承诺金额
  - 预算控制：预警（80%、90%）、冻结（100%）
  - 预算调整与审批

#### Day 206-210: 执行与成本收入
**开发者E + B 协助**

- **成本归集**
  - `application/commands/post_project_cost.rs`
  - 成本来源：物料领用（MM）、工时（HR）、采购（MM）、外部服务
  - 成本分配：直接成本、间接成本分摊
  - 与 Controlling Service 集成（成本对象）

- **挣值分析（EVM）**
  - `domain/services/earned_value_service.rs`
  - 计划值（PV）、挣值（EV）、实际成本（AC）
  - 成本偏差（CV = EV - AC）
  - 进度偏差（SV = EV - PV）
  - 成本绩效指数（CPI = EV / AC）
  - 进度绩效指数（SPI = EV / PV）
  - 完工预估（EAC）、完工尚需（ETC）

- **收入确认**
  - `domain/services/revenue_recognition_service.rs`
  - 完工百分比法（POC）：按成本百分比、按工作量百分比
  - 完工合同法（Completed Contract）
  - 与 Financial Service 集成（收入凭证）

- **变更与索赔管理**
  - `domain/aggregates/change_request.rs`: 变更请求聚合根
  - 变更影响分析：成本、进度、资源
  - 变更审批流程
  - 索赔管理：客户索赔、向供应商索赔

### 验收标准（PS）

#### 功能验收
- [ ] WBS 层级结构管理（创建、编辑、版本、基线）
- [ ] 网络活动与关键路径计算
- [ ] 里程碑管理与进度跟踪
- [ ] 预算分配与承诺控制
- [ ] 预算预警与冻结机制
- [ ] 成本归集（物料、工时、采购、外部服务）
- [ ] 挣值分析（CV、SV、CPI、SPI、EAC）
- [ ] 收入确认（完工百分比法、完工合同法）
- [ ] 变更请求管理与审批
- [ ] 索赔管理闭环

#### 集成验证
- [ ] 与 Materials Service 集成（物料领用 → 项目成本）
- [ ] 与 Production Service 集成（生产订单 → 项目成本）
- [ ] 与 HR Service 集成（工时 → 项目成本）
- [ ] 与 Financial Service 集成（成本凭证、收入凭证）
- [ ] 与 Controlling Service 集成（成本对象、利润中心）
- [ ] 与 CRM Service 集成（商机 → 项目交接）

#### 报表验证
- [ ] 项目进度报表（计划 vs. 实际）
- [ ] 项目成本报表（预算 vs. 实际 vs. 承诺）
- [ ] 挣值分析报表（CV、SV、CPI、SPI）
- [ ] 现金流预测报表
- [ ] 里程碑达成报表
- [ ] 合同毛利报表

#### 性能验证
- [ ] 关键路径计算：1000 活动 < 5 秒
- [ ] 挣值分析批处理：100 项目 < 2 分钟
- [ ] 成本归集批处理：10000 凭证 < 10 分钟

---

## 六、阶段 9 增强：分析与报表 BI/BW

### Month 11 Week 1-2（Day 211-220）：企业数据仓库与 BI

在原有 Analytics Service 基础上，增强为完整的企业数据仓库与 BI 平台。

#### Day 211-215: 数据仓库建模
**开发者A（领导）+ D 协助**

- **创建 data-warehouse-service 项目**
  ```
  services/data-warehouse-service/
  ├── models/
  │   ├── dimensions/
  │   │   ├── dim_customer.sql         # 客户维度
  │   │   ├── dim_material.sql         # 物料维度
  │   │   ├── dim_vendor.sql           # 供应商维度
  │   │   ├── dim_date.sql             # 日期维度
  │   │   ├── dim_organization.sql     # 组织维度
  │   │   └── dim_account.sql          # 科目维度
  │   ├── facts/
  │   │   ├── fact_financial_transaction.sql   # 财务交易事实表
  │   │   ├── fact_sales_order.sql             # 销售订单事实表
  │   │   ├── fact_purchase_order.sql          # 采购订单事实表
  │   │   ├── fact_inventory_movement.sql      # 库存移动事实表
  │   │   ├── fact_production_order.sql        # 生产订单事实表
  │   │   └── fact_payroll.sql                 # 薪资事实表
  │   └── aggregates/
  │       ├── agg_monthly_financials.sql       # 月度财务汇总
  │       ├── agg_daily_sales.sql              # 每日销售汇总
  │       └── agg_inventory_snapshot.sql       # 库存快照
  ```

- **星型模型设计**
  - 维度表设计：缓慢变化维度（SCD Type 2）
  - 事实表设计：事务粒度、快照粒度、累积粒度
  - 代理键策略（Surrogate Key）
  - 历史快照策略（每日/每月库存快照）

- **主数据对齐**
  - 与 MDG Service 主数据同步
  - 维度表与主数据表映射
  - 主数据变更 → 维度表更新（SCD Type 2）

#### Day 216-220: ETL 流程与数据质量
**开发者D（领导）+ A 协助**

- **数据采集**
  - CDC（Change Data Capture）：Debezium + Kafka
  - 事件总线采集：订阅所有服务领域事件
  - 批量 ETL：每日全量/增量同步
  - 准实时链路：Kafka → ClickHouse（< 1 分钟延迟）

- **数据转换**
  - 数据清洗：空值处理、格式标准化、异常值过滤
  - 数据转换：单位转换、货币转换、时区转换
  - 数据聚合：预计算聚合表（每日、每月、每年）
  - 数据血缘：记录数据来源和转换过程

- **数据质量**
  - `domain/services/data_quality_service.rs`
  - DQ 规则：完整性、唯一性、一致性、及时性、准确性
  - DQ 评分：每个事实表/维度表质量评分（0-100）
  - DQ 告警：质量阈值触发告警（完整性 < 95%）
  - DQ 补救流程：数据修复、重跑 ETL

- **语义层**
  - 业务指标定义：收入、成本、毛利、库存周转率、DSO 等
  - 计算字段：YoY（同比）、MoM（环比）、YTD（年初至今）
  - 权限控制：行级权限（按组织）、列级权限（敏感字段）、指标级权限

#### Day 216-220: BI 报表与仪表盘
**开发者E + D**

- **预定义报表**
  - **财务主题**：
    - 资产负债表、利润表、现金流量表
    - 账龄分析报表（AR/AP）
    - 成本中心报表、利润中心报表
    - 预算 vs. 实际对比报表
  - **供应链主题**：
    - 采购周期分析、供应商绩效
    - 销售漏斗、订单履约率
    - 库存周转率、库龄分析
    - 缺货率、超储率
  - **生产主题**：
    - 生产计划达成率
    - 在制品（WIP）报表
    - 工序效率、设备 OEE
    - 物料齐套率
  - **人力资源主题**：
    - 员工成本分析
    - 出勤率、加班统计
    - 离职率、招聘漏斗
    - 薪酬结构分析
  - **CRM 主题**：
    - 销售漏斗、转化率
    - 客户满意度（CSAT/NPS）
    - 活动 ROI
    - 服务工单 SLA 达成率

- **实时仪表盘**
  - 管理驾驶舱：高层 KPI（收入、利润、现金流、库存）
  - 财务仪表盘：实时凭证量、账龄分布、现金头寸
  - 供应链仪表盘：订单履约率、库存健康度、运输在途
  - 生产仪表盘：生产进度、设备状态、质量合格率
  - 告警仪表盘：异常订单、超期应收、库存短缺、质量缺陷

- **自助分析**
  - 拖拽式报表构建器（Metabase/Superset）
  - Ad-hoc 查询界面
  - 数据导出（Excel、PDF、CSV）
  - 报表订阅与定时推送

### 验收标准（BI/BW）

#### 功能验收
- [ ] 星型模型完整（10+ 维度表、6+ 事实表）
- [ ] SCD Type 2 历史追溯验证
- [ ] 主数据对齐验证（维度表 vs. 主数据表）
- [ ] CDC/事件/批量采集链路验证
- [ ] 数据质量规则上线（5 类规则：完整性、唯一性、一致性、及时性、准确性）
- [ ] DQ 评分与告警机制
- [ ] 语义层与业务指标定义
- [ ] 预定义报表上线（财务/供应链/生产/HR/CRM 至少 20 个报表）
- [ ] 实时仪表盘上线（5+ 主题仪表盘）
- [ ] 自助分析工具可用（Metabase/Superset）

#### 数据一致性验证
- [ ] 财务三表对账（资产负债表平衡、现金流量表勾稽）
- [ ] FI 与 CO/CO-PA 对齐验证
- [ ] 采购 P2P 对账（采购订单 → 收货 → 发票 → 付款）
- [ ] 销售 O2C 对账（销售订单 → 发货 → 开票 → 收款）
- [ ] 库存对账（物理库存 vs. 账面库存）
- [ ] 生产对账（生产订单 → 领料 → 报工 → 成品入库）
- [ ] 薪资对账（薪资核算 vs. 财务分录）

#### 性能验证
- [ ] CDC 延迟 < 30 秒（数据库变更 → Kafka → ClickHouse）
- [ ] 事件采集延迟 < 1 分钟
- [ ] 批量 ETL 窗口：每日全量 < 2 小时
- [ ] 报表查询响应时间：简单查询 P95 < 2 秒、复杂查询 P95 < 10 秒
- [ ] 并发查询支持：100 并发用户
- [ ] 仪表盘刷新延迟 < 5 秒

#### 数据质量验证
- [ ] 完整性：事实表关键字段非空率 > 99%
- [ ] 唯一性：维度表代理键唯一性 100%
- [ ] 一致性：跨表关联一致性 > 99.9%（外键校验）
- [ ] 及时性：T+1 数据可用性 > 99%（每日 8:00 前）
- [ ] 准确性：抽样对账准确率 > 99.99%

#### 运营验证
- [ ] 数据血缘可追溯（源表 → 转换 → 目标表）
- [ ] ETL 作业调度与重试机制
- [ ] ETL 失败告警与通知
- [ ] 数据备份与恢复演练（RTO < 4 小时、RPO < 1 小时）
- [ ] 容量规划（存储增长预测、查询性能趋势）

---

## 七、通用交付检查清单（所有阶段复用）

基于 BOM 文档的通用模块交付检查清单，适用于所有服务开发阶段。

### 7.1 领域与流程验收

- [ ] **限界上下文清晰定义**
  - 领域边界明确，不与其他服务重叠
  - 领域术语表（Ubiquitous Language）
  - 上下文映射关系（Context Map）

- [ ] **核心用例完整实现**
  - 主流程用例 100% 覆盖
  - 异常场景处理（补偿、重试、回滚）
  - 边界条件测试

- [ ] **状态机/生命周期**
  - 聚合根状态迁移图
  - 状态迁移规则验证
  - 非法状态迁移拒绝

- [ ] **审批流实现**
  - 审批流程配置化
  - 多级审批支持
  - 审批历史记录

### 7.2 数据模型与元数据验收

- [ ] **主数据/交易数据建模**
  - 数据库 ER 图
  - 索引策略（查询优化）
  - 分区策略（大表按日期/范围分区）

- [ ] **版本与变更管理**
  - 数据库迁移脚本（SQLx Migrations）
  - Schema 版本控制
  - 向后兼容性保证

- [ ] **历史快照**
  - 历史数据归档策略
  - 快照表设计（SCD Type 2）
  - 时间旅行查询支持

- [ ] **数据血缘**
  - 数据来源记录
  - 数据转换过程记录
  - 数据依赖关系图

### 7.3 API/gRPC 与事件验收

- [ ] **REST/gRPC 契约**
  - OpenAPI/Protobuf 定义完整
  - 错误码对齐（统一错误码表）
  - API 版本策略（/v1, /v2）

- [ ] **鉴权/鉴别**
  - JWT Token 验证
  - RBAC/ABAC 授权检查
  - API 限流策略

- [ ] **领域事件**
  - 事件定义清晰（事件名称、载荷、版本）
  - 事件发布幂等性
  - 事件顺序性保证（同一聚合）

- [ ] **集成事件**
  - 跨服务事件订阅
  - 事件消费幂等性（Idempotency Key）
  - 事件重试策略（指数退避）

- [ ] **事件溯源**
  - Event Store 完整性
  - 聚合重建验证
  - 事件回放验证

### 7.4 规则与工作流验收

- [ ] **业务规则引擎**
  - 定价规则配置化
  - 税务规则配置化
  - 信用检查规则配置化
  - 合规规则配置化

- [ ] **工作流引擎**
  - 工作流定义（BPMN 可选）
  - 工作流实例跟踪
  - 工作流超时处理

- [ ] **灰度发布**
  - Feature Flag 支持
  - 按用户/组织灰度
  - 灰度监控与回滚

### 7.5 集成验收

- [ ] **跨服务调用矩阵**
  - 服务依赖关系图
  - 调用链路追踪（Jaeger）
  - 熔断/降级策略（Circuit Breaker）

- [ ] **外部系统接口**
  - 银行接口（Swift/银企直连）
  - 税务接口（电子发票/报税）
  - 物流接口（承运商 API）
  - 设备接口（IoT/传感器）

- [ ] **批处理与实时链路**
  - 批处理作业调度（Cron/Argo Workflows）
  - 批处理监控与告警
  - 实时事件处理延迟监控

### 7.6 主数据与迁移验收

- [ ] **对齐 MDG 模式**
  - 主数据订阅 MDG 事件
  - 主数据缓存策略（Write-Through）
  - 主数据版本同步

- [ ] **初始/增量迁移**
  - 迁移脚本编写
  - 迁移数据校验（抽样/全量）
  - 迁移回滚预案

- [ ] **双写/只读切换策略**
  - 双写期验证（旧系统 vs. 新系统）
  - 只读期配置（禁止写入旧系统）
  - 切换检查清单

### 7.7 报表与数据产品验收

- [ ] **运营报表**
  - 实时运营看板
  - 日/周/月报表
  - 异常告警报表

- [ ] **法定报表**
  - 财务三大表
  - 税务申报表
  - 审计报表

- [ ] **管理看板**
  - 管理驾驶舱（KPI 仪表盘）
  - 下钻分析支持
  - 数据导出功能

- [ ] **自助分析语义层**
  - 业务指标定义
  - 计算字段配置
  - 自助查询界面

- [ ] **数据可见性权限**
  - 行级权限（按组织、部门）
  - 列级权限（敏感字段脱敏）
  - 指标级权限（财务指标）

### 7.8 权限与合规验收

- [ ] **RBAC/ABAC**
  - 角色定义完整
  - 权限矩阵清晰
  - 动态权限计算

- [ ] **职责分离（SoD）**
  - SoD 规则定义
  - SoD 冲突检查
  - SoD 违规告警

- [ ] **审计日志**
  - 所有写操作记录
  - 审计字段完整（Who、When、What、Where）
  - 审计日志不可篡改

- [ ] **留存周期**
  - 热数据留存策略（3 个月）
  - 温数据留存策略（1 年）
  - 冷数据归档策略（7 年）

- [ ] **隐私与同意管理**
  - PII 字段标识
  - 数据脱敏策略
  - 用户同意记录
  - 数据删除权（GDPR Right to be Forgotten）

### 7.9 可观测性与 SRE 验收

- [ ] **指标/日志/追踪基线**
  - Prometheus 指标暴露
  - 结构化日志（JSON 格式）
  - Jaeger 链路追踪集成

- [ ] **SLI/SLO**
  - 可用性 SLI（Uptime）
  - 延迟 SLI（P99 响应时间）
  - 错误率 SLI（Error Rate）
  - SLO 定义与告警阈值

- [ ] **告警路由**
  - 告警分级（P0/P1/P2/P3）
  - 告警路由规则（PagerDuty/Slack）
  - 告警收敛（防止告警风暴）

- [ ] **灰度/熔断/限流**
  - Feature Flag 灰度发布
  - Circuit Breaker 熔断策略
  - Rate Limiting 限流策略

### 7.10 性能与容量验收

- [ ] **基准与压测场景**
  - 性能基准定义（TPS、QPS、延迟）
  - 压测脚本编写（k6/wrk）
  - 压测环境配置

- [ ] **容量模型**
  - 按峰值 QPS 预估资源
  - 预留 30-50% 余量
  - 水平扩展验证（HPA）

- [ ] **缓存/分片策略**
  - Redis 缓存策略（热数据识别）
  - 数据库分片策略（按时间/按范围）
  - 缓存命中率监控（目标 > 85%）

- [ ] **批处理窗口**
  - 批处理时间窗口定义
  - 批处理性能优化（并行、分片）
  - 批处理失败重试机制

### 7.11 测试策略验收

- [ ] **单元/契约/集成/端到端/回归**
  - 单元测试覆盖率 > 80%（领域层 100%）
  - 契约测试（Pact/Spring Cloud Contract）
  - 集成测试（跨服务交互）
  - 端到端测试（完整业务流程）
  - 回归测试套件

- [ ] **金丝雀数据集**
  - 测试数据集准备
  - 金丝雀环境部署
  - 金丝雀监控与回滚

- [ ] **测试数据脱敏**
  - 生产数据脱敏策略
  - PII 字段脱敏规则
  - 脱敏数据验证

### 7.12 数据质量验收

- [ ] **完整性/唯一性/一致性/及时性规则**
  - 完整性规则：非空率、必填字段覆盖率
  - 唯一性规则：主键、业务键唯一性
  - 一致性规则：跨表关联一致性、外键完整性
  - 及时性规则：数据延迟监控（T+1 可用性）

- [ ] **DQ 告警与补救流程**
  - 数据质量评分（0-100）
  - DQ 阈值告警（< 95%）
  - DQ 补救流程（数据修复、重跑 ETL）

### 7.13 运维与自动化验收

- [ ] **CI/CD**
  - GitHub Actions 流程（Lint、Test、Build、Deploy）
  - Docker 镜像构建与推送
  - Kubernetes Deployment 自动化

- [ ] **数据库迁移脚本**
  - 迁移脚本版本控制
  - 迁移脚本测试（Up/Down）
  - 迁移脚本回滚验证

- [ ] **回滚/热修**
  - 蓝绿部署策略
  - 金丝雀发布策略
  - 快速回滚流程（< 5 分钟）

- [ ] **作业调度与重试**
  - Cron Job / Argo Workflows
  - 作业失败重试（指数退避）
  - 作业监控与告警

- [ ] **运行手册（Runbook）**
  - 服务启动/停止流程
  - 故障排查手册
  - 常见问题 FAQ
  - 联系人与升级路径

### 7.14 文档与培训验收

- [ ] **ADR（架构决策记录）**
  - 技术选型决策
  - 架构模式决策
  - 权衡分析记录

- [ ] **接口与事件清单**
  - REST API 文档（OpenAPI/Swagger）
  - gRPC 接口文档（Protobuf）
  - 事件目录（事件名称、载荷、版本）

- [ ] **运维 Runbook**
  - 部署流程
  - 监控指标说明
  - 告警处理流程
  - 灾难恢复流程

- [ ] **用户手册**
  - 业务流程说明
  - 功能操作指南
  - 常见问题解答

- [ ] **培训材料**
  - 培训 PPT
  - 视频教程
  - 实操演练脚本

### 7.15 Cutover 与 Rollout 验收

- [ ] **黑暗发布/灰度/全量切换步骤**
  - 黑暗发布：功能上线但不开放（Feature Flag Off）
  - 灰度发布：5% → 25% → 50% → 100% 流量切换
  - 全量发布：所有用户可用

- [ ] **回滚方案**
  - 回滚触发条件（错误率、延迟、用户反馈）
  - 回滚流程步骤
  - 回滚演练记录

- [ ] **业务验收/双轨期支持**
  - UAT（用户验收测试）通过
  - 双轨运行期（旧系统并行）
  - 双轨期数据对账
  - 旧系统下线计划

---

## 八、事件载荷标准模板

基于 BOM 文档的事件载荷最小字段模板，所有服务统一遵循。

### 8.1 事件元信息（必填）

```rust
pub struct EventMetadata {
    /// 事件唯一标识（幂等键）
    pub event_id: Uuid,

    /// 事件版本（语义版本）
    pub event_version: String,  // "1.0.0"

    /// 事件发生时间（UTC）
    pub occurred_at: DateTime<Utc>,

    /// 事件生产者（服务名称）
    pub producer: String,  // "financial-service"

    /// 关联 ID（用于追踪同一业务流程）
    pub correlation_id: Uuid,

    /// 分布式追踪 ID（Jaeger Trace ID）
    pub trace_id: String,
}
```

### 8.2 事件业务主体（必填）

```rust
pub struct EventPayload {
    /// 聚合类型
    pub aggregate_type: String,  // "Transaction", "SalesOrder", etc.

    /// 聚合 ID
    pub aggregate_id: Uuid,

    /// 业务数据（具体事件载荷）
    pub payload: serde_json::Value,

    /// 载荷 Schema 引用（可选，用于 Schema Registry）
    pub schema_ref: Option<String>,  // "financial.transaction.v1"
}
```

### 8.3 事件上下文（必填）

```rust
pub struct EventContext {
    /// 操作人（用户 ID 或系统账号）
    pub actor: String,

    /// 租户 ID（多租户场景）
    pub tenant_id: Option<String>,

    /// 来源系统
    pub source_system: String,  // "ERP", "CRM", "External API"

    /// IP 地址（可选）
    pub ip_address: Option<String>,

    /// 设备信息（可选）
    pub device: Option<String>,
}
```

### 8.4 事件合规信息（可选）

```rust
pub struct EventCompliance {
    /// 敏感度级别
    pub sensitivity: SensitivityLevel,  // Public, Internal, Confidential, Restricted

    /// 数字签名（可选，用于防篡改）
    pub signature: Option<String>,

    /// 留存策略标识
    pub retention: RetentionPolicy,  // ShortTerm(3m), MediumTerm(1y), LongTerm(7y)
}

pub enum SensitivityLevel {
    Public,         // 公开数据
    Internal,       // 内部数据
    Confidential,   // 机密数据（PII、财务）
    Restricted,     // 限制级数据（高管薪资、审计数据）
}
```

### 8.5 完整事件结构

```rust
pub struct DomainEvent {
    pub metadata: EventMetadata,
    pub payload: EventPayload,
    pub context: EventContext,
    pub compliance: Option<EventCompliance>,
}
```

### 8.6 事件示例：财务凭证过账事件

```json
{
  "metadata": {
    "event_id": "550e8400-e29b-41d4-a716-446655440000",
    "event_version": "1.0.0",
    "occurred_at": "2025-12-22T10:30:00Z",
    "producer": "financial-service",
    "correlation_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "trace_id": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
  },
  "payload": {
    "aggregate_type": "Transaction",
    "aggregate_id": "7d9e3f42-8c8a-4e5b-9f3a-1a2b3c4d5e6f",
    "payload": {
      "transaction_number": "FI-2025-0001234",
      "posting_date": "2025-12-22",
      "document_date": "2025-12-20",
      "company_code": "1000",
      "fiscal_year": 2025,
      "journal_entries": [
        {
          "account_number": "100000",
          "debit_amount": 10000.00,
          "credit_amount": 0.00,
          "currency": "USD"
        },
        {
          "account_number": "200000",
          "debit_amount": 0.00,
          "credit_amount": 10000.00,
          "currency": "USD"
        }
      ],
      "status": "Posted"
    },
    "schema_ref": "erp.financial.transaction.v1"
  },
  "context": {
    "actor": "user:john.doe@example.com",
    "tenant_id": "tenant-001",
    "source_system": "ERP",
    "ip_address": "192.168.1.100",
    "device": "Web Browser - Chrome 120"
  },
  "compliance": {
    "sensitivity": "Confidential",
    "signature": "SHA256:abcdef1234567890...",
    "retention": "LongTerm"
  }
}
```

---

## 九、性能与容量基准（增强版）

基于 BOM 文档的性能基准，补充更详细的指标。

### 9.1 API/事件性能基准

| 指标 | 目标值 | 测量方法 |
|-----|--------|---------|
| 核心写接口 P99 延迟 | < 200-300ms | k6 压测 |
| 核心读接口 P99 延迟 | < 150-200ms | k6 压测 |
| 非核心接口 P99 延迟 | < 500ms | k6 压测 |
| Kafka 事件处理滞留 | < 1 分钟 | Kafka Lag 监控 |
| 事件发布幂等率 | ≥ 99% | 事件 ID 去重统计 |
| API 可用性 | ≥ 99.9% | Uptime 监控 |
| API 错误率 | < 0.1% | Error Rate 监控 |

### 9.2 批处理性能基准

| 批处理任务 | 目标窗口 | 数据量 | 备注 |
|-----------|---------|--------|------|
| 财务关账（月结） | 2-4 小时 | 100K+ 凭证 | 夜间批处理 |
| 成本结算批次 | 1-2 小时 | 50K+ 成本对象 | 夜间批处理 |
| 三单匹配批次 | 30-60 分钟 | 10K+ 发票 | 夜间批处理 |
| 运费结算批次 | 30-60 分钟 | 5K+ 运输单 | 夜间批处理 |
| MRP 运算 | < 2 小时 | 10K+ SKU, 1K+ BOM | 夜间批处理 |
| IBP 需求预测 | < 30 分钟 | 10K+ SKU | 夜间批处理 |
| 薪资核算批次 | < 30 分钟 | 1K+ 员工 | 月度批处理 |
| BI ETL 批次 | < 2 小时 | 全量数据同步 | 夜间批处理 |

### 9.3 容量规划基准

| 资源 | 起步配置 | 扩展策略 | 备注 |
|-----|---------|---------|------|
| API 服务 | 2 副本 x 1 CPU x 2GB RAM | HPA: CPU > 70% → +1 副本 | 最大 10 副本 |
| 批处理服务 | 1 副本 x 2 CPU x 4GB RAM | 手动扩展 | 峰值时临时扩容 |
| PostgreSQL | 4 CPU x 16GB RAM | 垂直扩展 | 主从复制 |
| Redis | 2GB 内存 | 垂直扩展 | 集群模式（3 主 3 从） |
| Kafka | 3 Broker x 2 CPU x 8GB RAM | 增加 Broker | 分区数按主题调整 |
| ClickHouse | 4 CPU x 32GB RAM | 增加节点 | 分布式表 |

### 9.4 缓存性能基准

| 缓存项 | 命中率目标 | TTL | 失效策略 |
|-------|-----------|-----|---------|
| 主数据（客户/供应商/物料） | > 90% | 1 小时 | Write-Through（主数据变更时失效） |
| 科目余额 | > 85% | 5 分钟 | Write-Through（凭证过账时失效） |
| 库存快照 | > 80% | 1 分钟 | Write-Through（库存事务时失效） |
| 定价条件 | > 90% | 10 分钟 | Write-Through（定价条件变更时失效） |
| 用户权限 | > 95% | 15 分钟 | Write-Through（权限变更时失效） |
| 汇率 | > 95% | 1 小时 | 定时刷新（每小时拉取最新汇率） |

### 9.5 数据库性能基准

| 指标 | 目标值 | 优化手段 |
|-----|--------|---------|
| 连接池利用率 | < 80% | PgBouncer 连接池 |
| 慢查询比例 | < 1% | 添加索引、查询优化 |
| 死锁频率 | < 10 次/天 | 事务优化、锁粒度减小 |
| 读写比 | 读:写 = 7:3 | 读写分离（主写从读） |
| 备份恢复时间 | RTO < 5 分钟, RPO < 1 分钟 | WAL 归档 + PITR |

### 9.6 可用性基准

| 服务 | 可用性目标 | 容错策略 | 备注 |
|-----|-----------|---------|------|
| 核心服务（Financial、Materials、Sales） | 99.9% (43 分钟/月停机) | 多副本 + HPA + 健康检查 | P0 级别 |
| 重要服务（Production、HR、Quality） | 99.5% (3.6 小时/月停机) | 多副本 + 健康检查 | P1 级别 |
| 辅助服务（CRM、Analytics） | 99.0% (7.2 小时/月停机) | 单副本 + 手动恢复 | P2 级别 |
| PostgreSQL | 99.99% (4 分钟/月停机) | 主从复制 + 自动故障转移 | P0 级别 |
| Redis | 99.9% | 哨兵模式 + 自动故障转移 | P1 级别 |
| Kafka | 99.95% | 3 副本 + ISR | P0 级别 |

---

## 十、跨模块关键事件与接口基线

基于 BOM 文档，定义跨服务集成的关键事件和接口。

### 10.1 P2P（采购到付款）事件链

```
1. 采购申请创建 → erp.mm.purchase_requisition.created
2. 采购订单创建 → erp.mm.purchase_order.created
3. 采购订单发布 → erp.mm.purchase_order.released
4. 收货（GR） → erp.mm.goods_receipt.posted
   - 触发质检：erp.qm.inspection_lot.created（如启用质检）
   - 触发库存更新：Materials Service 内部处理
   - 触发财务凭证：erp.fi.journal_entry.posted（库存凭证）
5. 发票校验（三单匹配） → erp.mm.invoice.matched
   - 匹配成功：erp.mm.invoice.approved
   - 匹配失败：erp.mm.invoice.blocked
6. 付款批次 → erp.fi.payment.posted
   - 触发银行扣款：erp.tr.bank_statement.updated
7. 供应商主数据同步 → erp.mdg.vendor.updated
```

### 10.2 O2C（订单到收款）事件链

```
1. 销售订单创建 → erp.sd.sales_order.created
2. 信用检查 → erp.fscm.credit_check.completed
   - 通过：erp.fscm.credit_released
   - 拒绝：erp.fscm.credit_blocked
3. 库存预留 → erp.mm.inventory.reserved
4. 发货 → erp.sd.delivery.shipped
   - 触发仓库出库：erp.wm.outbound_delivery.completed
   - 触发运输创建：erp.tm.shipment.created
5. 开票 → erp.sd.invoice.issued
   - 触发财务应收：erp.fi.receivable.created
   - 触发电子发票：外部税控接口
6. 收款 → erp.fi.payment.received
   - 触发银行到账：erp.tr.bank_statement.updated
7. 退货/退款 → erp.sd.return.created → erp.fi.credit_memo.issued
8. 客户主数据同步 → erp.mdg.customer.updated
```

### 10.3 MTS/MTO/生产事件链

```
1. MRP 运行 → erp.pp.mrp.completed
   - 生成计划订单：erp.pp.planned_order.created
2. 计划订单转生产订单 → erp.pp.production_order.created
3. 物料预留 → erp.mm.inventory.reserved
4. 领料 → erp.mm.goods_issue.posted
   - 触发在制检验（可选）：erp.qm.inspection_lot.created
5. 报工 → erp.pp.operation.confirmed
   - 触发设备使用记录：erp.pm.equipment_usage.recorded
6. 报废/返工 → erp.pp.scrap.recorded / erp.pp.rework.created
7. 生产完工 → erp.pp.production_order.completed
   - 触发成品入库：erp.mm.goods_receipt.posted
   - 触发成品检验：erp.qm.inspection_lot.created
8. 成本结算 → erp.co.production_cost.settled
   - 触发财务凭证：erp.fi.journal_entry.posted
9. 物料主数据同步 → erp.mdg.material.updated
10. BOM 变更 → erp.pp.bom.updated
```

### 10.4 仓储/运输事件链

```
1. 入库通知 → erp.wm.inbound_delivery.created
2. 上架任务 → erp.wm.putaway_task.created
3. 上架完成 → erp.wm.putaway_task.completed
   - 触发库存更新：erp.mm.inventory.updated
4. 波次创建 → erp.wm.wave.created
5. 拣货任务 → erp.wm.picking_task.created
6. 拣货完成 → erp.wm.picking_task.completed
7. 包装完成 → erp.wm.packing.completed
8. 运输创建 → erp.tm.shipment.created
9. 承运商分配 → erp.tm.carrier.assigned
10. 在途更新 → erp.tm.shipment.in_transit
11. 签收（POD） → erp.tm.pod.received
    - 触发运费结算：erp.tm.freight.calculated
    - 触发财务凭证：erp.fi.journal_entry.posted
12. 盘点 → erp.wm.physical_inventory.completed
    - 触发盘点差异：erp.wm.inventory_difference.posted
```

### 10.5 财务/成本事件链

```
1. 凭证过账 → erp.fi.journal_entry.posted
2. 资产变动 → erp.fi.asset.updated
3. 关账状态 → erp.fi.period.closed
4. 成本分摊 → erp.co.allocation.posted
5. 成本结算 → erp.co.settlement.posted
6. CO-PA 分段 → erp.co.profitability.updated
7. 付款运行 → erp.tr.payment_factory.executed
8. 银行对账 → erp.tr.bank_reconciliation.completed
9. 汇率变更 → erp.mdg.exchange_rate.updated
10. 科目主数据变更 → erp.mdg.account.updated
```

### 10.6 主数据事件链

```
1. 业务伙伴创建 → erp.mdg.business_partner.created
2. 业务伙伴更新 → erp.mdg.business_partner.updated
   - 触发下游缓存失效：FI、MM、SD、CRM 订阅
3. 物料创建 → erp.mdg.material.created
4. 物料更新 → erp.mdg.material.updated
   - 触发下游缓存失效：MM、SD、PP、WM 订阅
5. 科目创建 → erp.mdg.account.created
6. 科目更新 → erp.mdg.account.updated
   - 触发下游缓存失效：FI、CO 订阅
7. 组织变更 → erp.mdg.organization.updated
   - 触发权限重新计算：IAM Service 订阅
8. 版本激活 → erp.mdg.version.activated
9. 重复检测 → erp.mdg.duplicate.detected
10. 合并完成 → erp.mdg.merge.completed
```

### 10.7 分析与数仓事件链

```
1. 事件总线采集 → 所有服务领域事件订阅
2. CDC 采集 → 数据库变更日志采集
3. 批量 ETL → erp.dw.etl.completed
4. 数据质量检查 → erp.dw.data_quality.checked
   - 质量不合格：erp.dw.data_quality.failed
5. 数据集发布 → erp.dw.dataset.published
6. 报表刷新 → erp.dw.report.refreshed
7. 告警触发 → erp.dw.alert.triggered
8. 血缘更新 → erp.dw.lineage.updated
```

---

## 十一、数据迁移与切换策略（增强版）

基于 BOM 文档，补充详细的数据迁移策略。

### 11.1 迁移范围与优先级

#### 第一批：主数据（Day 1-10）
- 业务伙伴主数据（客户、供应商）
- 物料主数据
- 科目表
- 组织架构（公司代码、工厂、库存地点、成本中心、利润中心）
- 币种、税码、计量单位
- 员工主数据、组织架构

#### 第二批：期初余额（Day 11-20）
- 科目余额（按公司代码、会计期间）
- 客户应收余额
- 供应商应付余额
- 库存余额（按物料、批次、库位）
- 在制品（WIP）余额
- 固定资产卡片与折旧余额

#### 第三批：未结单据（Day 21-30）
- 未结采购订单
- 未结销售订单
- 未结生产订单
- 未结维护工单
- 未结项目 WBS

#### 第四批：历史交易（Day 31-40，可选）
- 历史凭证（最近 2 年）
- 历史订单（最近 1 年）
- 历史库存事务（最近 6 个月）

### 11.2 迁移工具与流程

#### 11.2.1 迁移工具链
```
旧系统（KILLER/其他 ERP）
  ↓
数据抽取（SQL Export / RFC / API）
  ↓
数据清洗与映射（Python/Pandas/Spark）
  ↓
数据校验（数据质量检查）
  ↓
数据导入（Batch API / SQL Import）
  ↓
数据对账（四维度对账）
```

#### 11.2.2 抽取-清洗-映射脚本
```python
# 示例：业务伙伴迁移脚本
import pandas as pd
from typing import Dict, List

class BusinessPartnerMigration:
    def extract_from_KILLER(self) -> pd.DataFrame:
        """从 KILLER 抽取业务伙伴数据"""
        # RFC 调用 or SQL 查询
        pass

    def clean_and_transform(self, df: pd.DataFrame) -> pd.DataFrame:
        """数据清洗与转换"""
        # 1. 空值处理
        df = df.fillna({
            'phone': '',
            'email': '',
            'tax_number': ''
        })

        # 2. 格式标准化
        df['phone'] = df['phone'].apply(self.normalize_phone)
        df['email'] = df['email'].str.lower()

        # 3. 数据映射
        df['partner_type'] = df['customer_vendor_flag'].map({
            'K': 'Customer',
            'L': 'Vendor'
        })

        # 4. 数据验证
        df = df[df['email'].str.contains('@')]  # 邮箱格式验证

        return df

    def load_to_new_system(self, df: pd.DataFrame):
        """加载到新系统"""
        # 批量 API 调用
        for chunk in self.chunk_dataframe(df, chunk_size=1000):
            self.call_batch_api(chunk)

    def reconcile(self, df: pd.DataFrame):
        """数据对账"""
        # 四维度对账：数量、完整性、准确性、一致性
        pass
```

### 11.3 数据校验四维度

#### 11.3.1 数量对账
- 旧系统记录数 == 新系统记录数
- 按维度统计：按公司代码、按物料类型、按客户分组等

#### 11.3.2 完整性对账
- 必填字段非空率 > 95%
- 关键字段覆盖率 100%（如业务伙伴编号、物料编号）

#### 11.3.3 准确性对账
- 抽样对账：随机抽取 1000 条记录逐字段比对
- 金额对账：科目余额、应收应付、库存金额精确匹配（容差 < 0.01）

#### 11.3.4 一致性对账
- 跨表一致性：凭证借贷平衡、销售订单金额 == 发票金额
- 引用完整性：外键完整性检查（如销售订单 → 客户主数据）

### 11.4 双轨与切换策略

#### 11.4.1 双轨阶段（1-2 个月）
```
Day 1-30: 双写阶段
- 新业务同时写入旧系统和新系统
- 新系统只读模式（不对外暴露）
- 每日对账（新系统 vs. 旧系统）

Day 31-45: 灰度阶段
- 10% 流量切到新系统（只读查询）
- 监控新系统稳定性
- 每日对账

Day 46-60: 全量只读阶段
- 100% 读流量切到新系统
- 写流量仍在旧系统
- 双向对账

Day 61: 切换日
- 关闭旧系统写入
- 新系统开放写入
- 24 小时值班监控
```

#### 11.4.2 回滚预案
**触发条件**：
- 新系统错误率 > 1%
- 新系统 P99 延迟 > 1000ms 持续 10 分钟
- 数据一致性对账失败（差异 > 0.1%）
- 用户反馈严重 Bug（P0 级别）

**回滚流程**：
1. 停止新系统写入（Feature Flag Off）
2. 恢复旧系统写入
3. 数据回滚：丢弃新系统切换后产生的数据（如有）
4. 配置回滚：恢复旧系统 API 路由
5. 通知用户：系统已恢复正常
6. 事后分析：根因分析与修复计划

### 11.5 冻结窗口策略

#### 11.5.1 主数据冻结
- 冻结时间：切换前 24 小时
- 冻结范围：业务伙伴、物料、科目、组织架构
- 解冻时间：切换后验证通过（约 4 小时）

#### 11.5.2 关键交易冻结
- 冻结时间：切换日 00:00-06:00（6 小时窗口）
- 冻结范围：凭证过账、订单创建、库存事务、薪资核算
- 解冻策略：分批解冻（先凭证，再订单，最后库存）

#### 11.5.3 冲突解决流程
- 冲突检测：双写期间检测同一记录被修改
- 冲突解决策略：
  - 时间戳优先：最后写入胜出
  - 旧系统优先：双轨期旧系统为主
  - 人工仲裁：关键冲突由业务专家决定

### 11.6 合规与安全

#### 11.6.1 数据脱敏
- PII 字段脱敏：姓名、电话、邮箱、身份证号
- 脱敏算法：SHA256 Hash + Salt（不可逆）
- 财务数据脱敏：金额 ± 10% 随机偏移

#### 11.6.2 传输加密
- TLS 1.3 加密传输
- 数据库连接加密（PostgreSQL SSL）
- 文件传输加密（SFTP）

#### 11.6.3 访问审计
- 迁移操作全程审计
- 审计字段：操作人、操作时间、操作类型、IP 地址
- 审计日志留存 7 年

#### 11.6.4 留存与销毁
- 迁移脚本留存：3 年
- 迁移日志留存：7 年
- 临时数据销毁：迁移完成后 30 天内销毁

---

## 十二、总结与后续计划

### 12.1 本增强版计划的主要补充内容

1. **新增阶段 0**：平台与主数据治理（MDG/GRC/IAM）
2. **新增 TR/FSCM**：资金管理与财务供应链
3. **新增 SCM/IBP**：高级供应链计划
4. **新增 PS**：项目系统
5. **增强 BI/BW**：企业数据仓库与完整 BI 平台
6. **通用交付检查清单**：15 个维度的验收标准
7. **事件载荷标准模板**：统一的事件结构
8. **性能与容量基准**：详细的性能指标
9. **跨模块事件与接口基线**：6 大业务流程事件链
10. **数据迁移与切换策略**：完整的迁移方案

### 12.2 与原计划的关系

- **Month 1-2**：在原基础设施建设基础上，增加阶段 0（主数据治理与 IAM）
- **Month 3-5**：在原 Financial Service 基础上，增加 TR/FSCM 模块
- **Month 6-8**：保持原供应链模块计划
- **Month 9-10**：在原 HR/Quality/Maintenance 基础上，增加 WM/TM 和 SCM/IBP、PS
- **Month 11**：增强 Analytics Service 为完整的 BI/BW 平台
- **Month 12**：保持原上线准备计划

### 12.3 关键成功因素

1. **严格验收**：每个阶段结束必须通过通用交付检查清单验收
2. **事件驱动**：所有服务间集成优先使用事件驱动，减少同步调用
3. **数据质量**：主数据治理从第一天开始，数据质量 KPI 纳入绩效考核
4. **性能监控**：每个 Sprint 结束都要进行性能基准测试
5. **文档先行**：ADR、接口文档、Runbook 与代码同步更新
6. **灰度发布**：所有新功能必须通过 Feature Flag 灰度发布
7. **数据迁移**：提前 2 个月开始迁移准备，多轮演练

### 12.4 后续 12-24 个月计划（可选）

- **Month 13-15**：移动端应用（React Native/Flutter）
- **Month 16-18**：高级分析（机器学习预测、智能推荐）
- **Month 19-21**：国际化（多语言、多币种、多时区）
- **Month 22-24**：行业特化（制造业 MES、零售业 POS、服务业 FSM）

---

**文档维护**：
- 本文档应与 Rust-Abc.md 和 Rust-BOM.md 保持同步
- 每个 Sprint 结束后更新进度和验收状态
- 每个 Stage Review 后更新风险和改进措施

**联系方式**：team@rust-erp.example.com
