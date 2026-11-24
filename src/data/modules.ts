/**
 * Workspai Modules Data
 * Source: core/src/modules/free
 */

export interface ModuleData {
  id: string;
  name: string;
  version: string;
  category: string;
  icon: string;
  description: string;
  status: 'stable' | 'beta' | 'experimental';
  dependencies?: string[];
  frameworks?: string[];
  capabilities?: string[];
  tags?: string[];
  slug: string; // Full slug like "free/auth/oauth"
}

export const MODULE_CATALOG_CORE_VERSION = '0.6.3';

export const MODULES: ModuleData[] = [
  // AI Modules
  {
    id: 'agent_runtime',
    name: 'Agent Runtime',
    version: '0.1.18',
    category: 'ai',
    icon: '🤖',
    description:
      'Agent runtime scaffolding for tools, memory, execution state, retries, and observable AI workflows',
    status: 'stable',
    tags: ['agents', 'ai', 'memory', 'tools', 'workflow'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: [
      'free/ai/llm_gateway',
      'free/tasks/workflow_engine',
      'free/cache/redis',
      'free/observability/core',
    ],
    capabilities: [
      'agent_execution',
      'execution_state',
      'health_checks',
      'memory_hooks',
      'retry_policy',
      'tool_invocation',
    ],
    slug: 'free/ai/agent_runtime',
  },

  {
    id: 'ai_assistant',
    name: 'Ai Assistant',
    version: '0.1.24',
    category: 'ai',
    icon: '🤖',
    description: 'Provider-agnostic...',
    status: 'stable',
    tags: ['ai', 'core'],
    frameworks: ['fastapi', 'nestjs'],
    capabilities: ['health_checks', 'override_support', 'runtime_scaffolding'],
    slug: 'free/ai/ai_assistant',
  },

  {
    id: 'ai_guardrails',
    name: 'Ai Guardrails',
    version: '0.1.12',
    category: 'ai',
    icon: '🤖',
    description: 'AI input/output safety policy, PII redaction hooks, and model boundary checks',
    status: 'stable',
    tags: ['ai', 'guardrails', 'pii', 'policy', 'safety'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: [
      'free/ai/llm_gateway',
      'free/ai/tool_registry',
      'free/security/audit_policy',
      'free/observability/core',
    ],
    capabilities: [
      'blocked_term_policy',
      'health_checks',
      'input_output_safety_checks',
      'pii_detection',
      'pii_redaction',
      'secret_detection',
    ],
    slug: 'free/ai/ai_guardrails',
  },

  {
    id: 'llm_gateway',
    name: 'Llm Gateway',
    version: '0.1.21',
    category: 'ai',
    icon: '🤖',
    description:
      'Provider-neutral LLM gateway with routing, fallback, budgets, and usage telemetry for AI products',
    status: 'stable',
    tags: ['ai', 'gateway', 'llm', 'routing', 'telemetry'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: [
      'free/essentials/settings',
      'free/essentials/logging',
      'free/observability/core',
    ],
    capabilities: [
      'budget_controls',
      'health_checks',
      'model_fallback',
      'override_support',
      'provider_routing',
      'usage_telemetry',
    ],
    slug: 'free/ai/llm_gateway',
  },

  {
    id: 'prompt_ops',
    name: 'Prompt Ops',
    version: '0.1.12',
    category: 'ai',
    icon: '🤖',
    description:
      'Prompt versioning, rollout, evaluation, rollback, and audit operations for AI products',
    status: 'stable',
    tags: ['ai', 'audit', 'evaluations', 'prompts', 'rollback'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: ['free/ai/llm_gateway', 'free/security/audit_policy', 'free/observability/core'],
    capabilities: [
      'health_checks',
      'prompt_audit',
      'prompt_evaluations',
      'prompt_publish_approval',
      'prompt_rollback',
      'prompt_versioning',
    ],
    slug: 'free/ai/prompt_ops',
  },

  {
    id: 'rag_pipeline',
    name: 'Rag Pipeline',
    version: '0.1.14',
    category: 'ai',
    icon: '🤖',
    description:
      'RAG pipeline scaffolding for ingestion, embeddings, retrieval, citations, and evaluation-ready AI search',
    status: 'stable',
    tags: ['ai', 'documents', 'embeddings', 'rag', 'retrieval'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: [
      'free/ai/llm_gateway',
      'free/ai/vector_store',
      'free/business/storage',
      'free/tasks/celery',
    ],
    capabilities: [
      'citations',
      'document_ingestion',
      'embedding_jobs',
      'evaluation_hooks',
      'health_checks',
      'retrieval',
    ],
    slug: 'free/ai/rag_pipeline',
  },

  {
    id: 'tool_registry',
    name: 'Tool Registry',
    version: '0.1.12',
    category: 'ai',
    icon: '🤖',
    description:
      'Tool registry, schemas, permissions, and audit-safe invocation policy for AI products',
    status: 'stable',
    tags: ['ai', 'audit', 'permissions', 'schemas', 'tools'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: ['free/security/audit_policy', 'free/observability/core'],
    capabilities: [
      'health_checks',
      'high_risk_tool_gates',
      'invocation_audit',
      'tool_permission_policy',
      'tool_schema_registry',
    ],
    slug: 'free/ai/tool_registry',
  },

  {
    id: 'vector_store',
    name: 'Vector Store',
    version: '0.1.14',
    category: 'ai',
    icon: '🤖',
    description:
      'Vector store abstraction for pgvector/Qdrant-style indexes, similarity search, and embedding metadata',
    status: 'stable',
    tags: ['ai', 'embeddings', 'pgvector', 'search', 'vectors'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: ['free/database/db_postgres', 'free/essentials/settings'],
    capabilities: [
      'embedding_storage',
      'health_checks',
      'metadata_filters',
      'similarity_search',
      'vector_indexing',
    ],
    slug: 'free/ai/vector_store',
  },

  // Authentication Modules
  {
    id: 'api_keys',
    name: 'API Keys',
    version: '0.1.9',
    category: 'auth',
    icon: '🔐',
    description: 'Deterministic API key issuance, verification, and auditing',
    status: 'stable',
    tags: ['api-keys', 'auditing', 'auth', 'security'],
    frameworks: ['fastapi', 'nestjs'],
    capabilities: [
      'audit_trail',
      'deterministic_token_issuance',
      'fastapi_router',
      'health_reporting',
      'nestjs_provider',
      'scope_enforcement',
    ],
    slug: 'free/auth/api_keys',
  },

  {
    id: 'auth_core',
    name: 'Authentication Core',
    version: '0.1.17',
    category: 'auth',
    icon: '🔐',
    description:
      'Opinionated password hashing, token signing, and runtime helpers that provide consistent authentication primitives across RapidKit applications.',
    status: 'stable',
    tags: ['auth', 'passwords', 'security', 'tokens'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: ['free/essentials/settings'],
    capabilities: ['dependency_injection', 'health_checks', 'password_hashing', 'token_signing'],
    slug: 'free/auth/core',
  },

  {
    id: 'oauth',
    name: 'OAuth Providers',
    version: '0.1.19',
    category: 'auth',
    icon: '🔐',
    description:
      'Lightweight OAuth 2.0 scaffolding with provider registry, state tracking, and callback helpers for RapidKit applications.',
    status: 'stable',
    tags: ['auth'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: ['free/essentials/settings'],
    capabilities: [
      'oauth_provider_registry',
      'oauth_router_scaffold',
      'oauth_token_exchange_helpers',
    ],
    slug: 'free/auth/oauth',
  },

  {
    id: 'passwordless',
    name: 'Passwordless Authentication',
    version: '0.1.16',
    category: 'auth',
    icon: '🔐',
    description:
      'Magic link and one-time code authentication helpers for frictionless login experiences across web and mobile clients.',
    status: 'stable',
    tags: ['auth'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: ['free/essentials/settings'],
    capabilities: [
      'passwordless_delivery_hooks',
      'passwordless_router_scaffold',
      'passwordless_token_runtime',
    ],
    slug: 'free/auth/passwordless',
  },

  {
    id: 'session',
    name: 'Session Management',
    version: '0.1.18',
    category: 'auth',
    icon: '🔐',
    description:
      'Opinionated session management utilities offering signed session tokens, cookie helpers, and pluggable storage for RapidKit applications.',
    status: 'stable',
    tags: ['auth'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: ['free/essentials/settings'],
    capabilities: ['session_cookie_helpers', 'session_router_scaffold', 'session_token_runtime'],
    slug: 'free/auth/session',
  },

  // Billing Modules
  {
    id: 'cart',
    name: 'Cart',
    version: '0.1.21',
    category: 'billing',
    icon: '💳',
    description: 'Shopping cart service for checkout flows',
    status: 'stable',
    tags: ['billing', 'cart'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: ['free/essentials/settings', 'free/users/users_core'],
    capabilities: [
      'cart_management',
      'discount_engine',
      'health_checks',
      'pricing_rules',
      'tax_calculation',
    ],
    slug: 'free/billing/cart',
  },

  {
    id: 'inventory',
    name: 'Inventory',
    version: '0.1.14',
    category: 'billing',
    icon: '💳',
    description: 'Inventory and pricing service backing Cart + Stripe',
    status: 'stable',
    tags: ['billing', 'inventory'],
    frameworks: ['fastapi', 'nestjs'],
    capabilities: ['activity-metrics', 'reservations', 'stock-management'],
    slug: 'free/billing/inventory',
  },

  {
    id: 'stripe_payment',
    name: 'Stripe Payment',
    version: '0.1.9',
    category: 'billing',
    icon: '💳',
    description: 'Stripe payments and subscriptions',
    status: 'stable',
    tags: ['billing', 'stripe-payment'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: [
      'free/database/db_postgres',
      'free/essentials/settings',
      'free/users/users_core',
    ],
    slug: 'free/billing/stripe_payment',
  },

  {
    id: 'usage_billing',
    name: 'Usage Billing',
    version: '0.1.14',
    category: 'billing',
    icon: '💳',
    description:
      'Usage metering, quota enforcement, plan limits, and overage scaffolding for SaaS products',
    status: 'stable',
    tags: ['billing', 'metering', 'plans', 'quota', 'usage'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: [
      'free/billing/stripe_payment',
      'free/billing/inventory',
      'free/business/multi_tenancy',
    ],
    capabilities: [
      'entitlement_gates',
      'overage_hooks',
      'plan_limits',
      'quota_enforcement',
      'usage_metering',
    ],
    slug: 'free/billing/usage_billing',
  },

  // Business Modules
  {
    id: 'admin_console',
    name: 'Admin Console',
    version: '0.1.11',
    category: 'business',
    icon: '💼',
    description:
      'Reusable admin console foundation with action registry, permission checks, audit context, and operational summaries',
    status: 'stable',
    tags: ['admin', 'audit', 'business', 'operations'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: [
      'free/business/approval_engine',
      'free/security/audit_policy',
      'free/observability/core',
    ],
    capabilities: [
      'admin_action_registry',
      'health_checks',
      'operational_summary',
      'permission_checks',
      'required_reasons',
      'run_history',
    ],
    slug: 'free/business/admin_console',
  },

  {
    id: 'approval_engine',
    name: 'Approval Engine',
    version: '0.1.12',
    category: 'business',
    icon: '💼',
    description:
      'Approval workflow engine with policies, required reasons, reviewer decisions, escalation, and immutable audit trails',
    status: 'stable',
    tags: ['admin', 'approvals', 'audit', 'business', 'workflow'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: [
      'free/security/audit_policy',
      'free/observability/core',
      'free/tasks/workflow_engine',
    ],
    capabilities: [
      'approval_policies',
      'escalation',
      'health_checks',
      'immutable_audit',
      'required_reasons',
      'reviewer_decisions',
      'tenant_scoped_approvals',
    ],
    slug: 'free/business/approval_engine',
  },

  {
    id: 'connector_hub',
    name: 'Connector Hub',
    version: '0.1.14',
    category: 'business',
    icon: '💼',
    description:
      'Integration connector hub scaffolding for external apps, credentials, sync jobs, and provider adapters',
    status: 'stable',
    tags: ['adapters', 'connectors', 'integrations', 'oauth', 'sync'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: ['free/auth/oauth', 'free/tasks/workflow_engine', 'free/security/audit_policy'],
    capabilities: [
      'audit_hooks',
      'connector_health',
      'credential_profiles',
      'provider_adapters',
      'sync_jobs',
    ],
    slug: 'free/business/connector_hub',
  },

  {
    id: 'connector_pack_library',
    name: 'Connector Pack Library',
    version: '0.1.11',
    category: 'business',
    icon: '💼',
    description:
      'Connector pack registry for provider catalogs, scopes, install state, health, and credential rotation workflows',
    status: 'stable',
    tags: ['business', 'catalog', 'connectors', 'integrations'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: [
      'free/business/connector_hub',
      'free/security/audit_policy',
      'free/observability/core',
    ],
    capabilities: [
      'connector_catalog',
      'connector_health',
      'credential_rotation',
      'health_checks',
      'install_state',
      'scope_registry',
    ],
    slug: 'free/business/connector_pack_library',
  },

  {
    id: 'document_pipeline',
    name: 'Document Pipeline',
    version: '0.1.12',
    category: 'business',
    icon: '💼',
    description:
      'Document ingestion, extraction, chunking, classification, and audit-safe processing pipeline for AI/workflow products',
    status: 'stable',
    tags: ['business', 'chunking', 'classification', 'documents', 'extraction', 'ingestion'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: [
      'free/business/storage',
      'free/security/audit_policy',
      'free/observability/core',
    ],
    capabilities: [
      'chunking',
      'classification',
      'document_ingestion',
      'health_checks',
      'processing_audit',
      'text_extraction',
    ],
    slug: 'free/business/document_pipeline',
  },

  {
    id: 'feature_flags',
    name: 'Feature Flags',
    version: '0.1.13',
    category: 'business',
    icon: '💼',
    description:
      'Feature flag scaffolding for staged rollout, entitlement-aware gates, experiments, and kill switches',
    status: 'stable',
    tags: ['experiments', 'feature-flags', 'kill-switches', 'rollout'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: ['free/essentials/settings', 'free/cache/redis'],
    capabilities: [
      'audit_hooks',
      'entitlement_gates',
      'flag_evaluation',
      'kill_switches',
      'percentage_rollout',
    ],
    slug: 'free/business/feature_flags',
  },

  {
    id: 'forms_engine',
    name: 'Forms Engine',
    version: '0.1.12',
    category: 'business',
    icon: '💼',
    description:
      'Schema-driven forms engine with validation, submissions, workflow hooks, and audit-ready exports',
    status: 'stable',
    tags: ['business', 'forms', 'submissions', 'validation', 'workflow'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: [
      'free/security/audit_policy',
      'free/observability/core',
      'free/tasks/workflow_engine',
    ],
    capabilities: [
      'csv_export',
      'health_checks',
      'schema_forms',
      'submission_validation',
      'tenant_scoped_forms',
      'workflow_hooks',
    ],
    slug: 'free/business/forms_engine',
  },

  {
    id: 'media_pipeline',
    name: 'Media Pipeline',
    version: '0.1.12',
    category: 'business',
    icon: '💼',
    description:
      'Media ingestion and transformation pipeline with checksum, variant generation, and moderation hooks',
    status: 'stable',
    tags: ['assets', 'business', 'media', 'moderation', 'variants'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: [
      'free/business/storage',
      'free/security/audit_policy',
      'free/observability/core',
    ],
    capabilities: [
      'checksum_verification',
      'health_checks',
      'media_ingestion',
      'moderation_hooks',
      'tenant_scoped_assets',
      'variant_generation',
    ],
    slug: 'free/business/media_pipeline',
  },

  {
    id: 'multi_tenancy',
    name: 'Multi Tenancy',
    version: '0.1.14',
    category: 'business',
    icon: '💼',
    description:
      'Organization, team, tenant isolation, membership, and tenant-aware request context scaffolding',
    status: 'stable',
    tags: ['isolation', 'organizations', 'saas', 'teams', 'tenancy'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: ['free/auth/core', 'free/users/users_core', 'free/database/db_postgres'],
    capabilities: [
      'admin_scopes',
      'organization_model',
      'team_membership',
      'tenant_context',
      'tenant_isolation',
    ],
    slug: 'free/business/multi_tenancy',
  },

  {
    id: 'org_admin_console',
    name: 'Org Admin Console',
    version: '0.1.11',
    category: 'business',
    icon: '💼',
    description:
      'Organization admin console for tenant settings, memberships, invitations, roles, and governance workflows',
    status: 'stable',
    tags: ['admin', 'business', 'organizations', 'tenancy'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: [
      'free/business/multi_tenancy',
      'free/business/admin_console',
      'free/security/audit_policy',
    ],
    capabilities: [
      'health_checks',
      'invitations',
      'membership_admin',
      'organization_settings',
      'role_governance',
      'tenant_audit',
    ],
    slug: 'free/business/org_admin_console',
  },

  {
    id: 'storage',
    name: 'Storage',
    version: '0.1.17',
    category: 'business',
    icon: '💼',
    description:
      'File Storage & Media Management Module - Upload, store, and manage files with support for local and S3/GCS backends',
    status: 'stable',
    tags: ['business', 'file-upload', 'gcs', 'media-management', 's3', 'storage'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: ['free/essentials/logging', 'free/essentials/settings'],
    capabilities: [
      'checksum_verification',
      'file_storage',
      'file_upload',
      'gcs_support',
      'health_checks',
      'image_processing',
      'malware_scan_hook',
      'media_management',
      's3_support',
      'signed_download_tokens',
    ],
    slug: 'free/business/storage',
  },

  {
    id: 'support_center',
    name: 'Support Center',
    version: '0.1.11',
    category: 'business',
    icon: '💼',
    description:
      'Support center foundation with tickets, SLA state, customer notes, assignments, and audit-ready support workflows',
    status: 'stable',
    tags: ['audit', 'business', 'sla', 'support', 'tickets'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: [
      'free/security/audit_policy',
      'free/observability/core',
      'free/communication/notifications',
      'free/communication/email',
    ],
    capabilities: [
      'assignments',
      'audit_trail',
      'customer_operations',
      'health_checks',
      'sla_breach_detection',
      'support_notes',
      'ticket_lifecycle',
    ],
    slug: 'free/business/support_center',
  },

  // Cache Modules
  {
    id: 'redis',
    name: 'Redis Cache',
    version: '0.1.26',
    category: 'cache',
    icon: '🔴',
    description:
      'Production-ready Redis runtime with async and sync clients, FastAPI dependencies, NestJS configuration helpers, and health probes built on resilient retry logic.',
    status: 'stable',
    tags: ['cache', 'datastore', 'redis'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: ['free/essentials/settings'],
    capabilities: ['cache'],
    slug: 'free/cache/redis',
  },

  // Communication Modules
  {
    id: 'email',
    name: 'Email',
    version: '0.1.27',
    category: 'communication',
    icon: '📧',
    description: '',
    status: 'stable',
    tags: ['communication', 'email', 'marketing', 'transactional'],
    frameworks: ['fastapi', 'nestjs'],
    capabilities: [
      'bounce_tracking',
      'communication',
      'delivery_log',
      'email',
      'fastapi',
      'nestjs',
      'retry_policy',
      'templated_delivery',
    ],
    slug: 'free/communication/email',
  },

  {
    id: 'notifications',
    name: 'Unified Notifications',
    version: '0.1.34',
    category: 'communication',
    icon: '📧',
    description:
      'Email-first notifications runtime offering SMTP delivery, template rendering, provider registry, and health instrumentation for RapidKit applications.',
    status: 'stable',
    tags: ['communication', 'email', 'notifications'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: ['free/essentials/settings'],
    capabilities: [
      'audit_metadata',
      'delivery_log',
      'email_push_sms_channels',
      'notification_provider_registry',
      'provider_health',
    ],
    slug: 'free/communication/notifications',
  },

  {
    id: 'webhook_platform',
    name: 'Webhook Platform',
    version: '0.1.14',
    category: 'communication',
    icon: '📧',
    description:
      'Inbound and outbound webhook scaffolding with signatures, delivery attempts, replay, and event history',
    status: 'stable',
    tags: ['events', 'integrations', 'replay', 'signatures', 'webhooks'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: ['free/auth/api_keys', 'free/tasks/celery', 'free/database/db_postgres'],
    capabilities: [
      'delivery_attempts',
      'inbound_webhooks',
      'outbound_delivery',
      'replay',
      'signature_verification',
    ],
    slug: 'free/communication/webhook_platform',
  },

  // Database Modules
  {
    id: 'db_mongo',
    name: 'Db Mongo',
    version: '0.1.14',
    category: 'database',
    icon: '🗄️',
    description:
      'MongoDB integration with async driver support, health diagnostics, configuration scaffolding, and multi-framework adapters',
    status: 'stable',
    tags: ['database', 'db-mongo'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: ['free/essentials/settings'],
    capabilities: ['database', 'fastapi', 'mongo', 'nestjs'],
    slug: 'free/database/db_mongo',
  },

  {
    id: 'db_sqlite',
    name: 'Db Sqlite',
    version: '0.1.16',
    category: 'database',
    icon: '🗄️',
    description: 'SQLite database integration for development',
    status: 'stable',
    tags: ['database', 'db-sqlite'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: ['free/essentials/settings'],
    capabilities: ['database', 'fastapi', 'nestjs', 'sqlite'],
    slug: 'free/database/db_sqlite',
  },

  {
    id: 'db_postgres',
    name: 'PostgreSQL',
    version: '0.1.35',
    category: 'database',
    icon: '🗄️',
    description: 'SQLAlchemy async+sync Postgres with clean DI, healthchecks, and pool config',
    status: 'stable',
    tags: ['asyncpg', 'connection-pool', 'database', 'postgresql', 'sqlalchemy'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: ['free/essentials/settings'],
    capabilities: [
      'async_engine',
      'connection_pooling',
      'dependency_injection',
      'health_checks',
      'sync_engine',
      'transaction_management',
    ],
    slug: 'free/database/db_postgres',
  },

  // Essentials Modules
  {
    id: 'settings',
    name: 'Application Settings',
    version: '0.1.50',
    category: 'essentials',
    icon: '🏗️',
    description:
      'Centralized, modular configuration management using Pydantic Settings with support for dynamic extensions, multi-source loading, and standard-grade security.',
    status: 'stable',
    tags: ['config', 'env', 'settings'],
    frameworks: ['fastapi', 'nestjs'],
    slug: 'free/essentials/settings',
  },

  {
    id: 'deployment',
    name: 'Deployment Toolkit',
    version: '0.1.18',
    category: 'essentials',
    icon: '🏗️',
    description: 'Portable Docker, Compose, Makefile, and CI assets for RapidKit projects.',
    status: 'stable',
    tags: ['deployment', 'devops', 'essentials'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: ['free/essentials/logging', 'free/essentials/settings'],
    slug: 'free/essentials/deployment',
  },

  {
    id: 'middleware',
    name: 'Middleware',
    version: '0.1.27',
    category: 'essentials',
    icon: '🏗️',
    description: 'HTTP middleware pipeline with FastAPI and NestJS support.',
    status: 'stable',
    tags: ['essentials', 'http', 'middleware'],
    frameworks: ['fastapi', 'nestjs'],
    slug: 'free/essentials/middleware',
  },

  {
    id: 'logging',
    name: 'Structured Logging & Observability',
    version: '0.1.19',
    category: 'essentials',
    icon: '🏗️',
    description:
      'Structured logging runtime with correlation IDs, multi-sink transport, async queue handling, redaction filters, sampling, and framework-ready bridges for metrics and OpenTelemetry.',
    status: 'stable',
    tags: ['logging', 'observability', 'tracing'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: ['free/essentials/settings'],
    slug: 'free/essentials/logging',
  },

  // Observability Modules
  {
    id: 'analytics_dashboard',
    name: 'Analytics Dashboard',
    version: '0.1.11',
    category: 'observability',
    icon: '📊',
    description:
      'Analytics dashboard foundation with metrics, widgets, dashboard snapshots, drilldowns, and audit-ready reporting',
    status: 'stable',
    tags: ['analytics', 'dashboards', 'metrics', 'observability'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: ['free/observability/core', 'free/essentials/logging'],
    capabilities: [
      'dashboard_snapshots',
      'dashboard_widgets',
      'filtered_drilldowns',
      'health_checks',
      'metric_points',
      'product_reporting',
    ],
    slug: 'free/observability/analytics_dashboard',
  },

  {
    id: 'observability_core',
    name: 'Observability Core',
    version: '0.1.19',
    category: 'observability',
    icon: '📊',
    description:
      'Cohesive metrics, tracing, and structured logging foundation for RapidKit services.',
    status: 'stable',
    tags: ['logging', 'metrics', 'observability', 'telemetry', 'tracing'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: ['free/essentials/logging', 'free/essentials/settings'],
    capabilities: [
      'fastapi_adapter',
      'metrics_export',
      'nestjs_provider',
      'structured_logging',
      'telemetry_events',
      'tracing_spans',
    ],
    slug: 'free/observability/core',
  },

  // Security Modules
  {
    id: 'audit_policy',
    name: 'Audit Policy',
    version: '0.1.13',
    category: 'security',
    icon: '🛡️',
    description:
      'Immutable audit event, admin policy, reason capture, and compliance export scaffolding',
    status: 'stable',
    tags: ['admin', 'audit', 'compliance', 'policy', 'security'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: ['free/essentials/logging', 'free/database/db_postgres', 'free/users/users_core'],
    capabilities: [
      'admin_policy',
      'compliance_export',
      'immutable_audit_events',
      'reason_capture',
      'tamper_evidence',
    ],
    slug: 'free/security/audit_policy',
  },

  {
    id: 'cors',
    name: 'Cors',
    version: '0.1.19',
    category: 'security',
    icon: '🛡️',
    description: 'Cross-Origin Resource Sharing security module',
    status: 'stable',
    tags: ['security'],
    frameworks: ['fastapi', 'nestjs'],
    slug: 'free/security/cors',
  },

  {
    id: 'rate_limiting',
    name: 'Rate Limiting',
    version: '0.1.18',
    category: 'security',
    icon: '🛡️',
    description:
      'Production-grade request throttling with configurable rules, FastAPI middleware, NestJS guard helpers, and optional Redis-backed quota storage.',
    status: 'stable',
    tags: ['rate-limiting', 'security', 'throttling'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: ['free/essentials/settings'],
    capabilities: ['rate-limiting', 'security'],
    slug: 'free/security/rate_limiting',
  },

  {
    id: 'security_headers',
    name: 'Security Headers',
    version: '0.1.11',
    category: 'security',
    icon: '🛡️',
    description:
      'Harden HTTP responses with industry-standard security headers, FastAPI middleware, and NestJS providers including health telemetry and diagnostics.',
    status: 'stable',
    tags: ['security', 'security-headers'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: ['free/essentials/settings'],
    capabilities: ['health-reporting', 'http-middleware', 'security-hardening'],
    slug: 'free/security/security_headers',
  },

  // Tasks Modules
  {
    id: 'celery',
    name: 'Celery',
    version: '0.1.16',
    category: 'tasks',
    icon: '⚡',
    description: 'Production-ready Celery task orchestration for asynchronous workloads',
    status: 'stable',
    tags: ['async', 'queue', 'tasks'],
    frameworks: ['fastapi', 'nestjs'],
    capabilities: [
      'async',
      'beat_schedule',
      'queue',
      'retry_policy',
      'task_metadata',
      'tasks',
      'worker_profile',
    ],
    slug: 'free/tasks/celery',
  },

  {
    id: 'event_bus',
    name: 'Event Bus',
    version: '0.1.12',
    category: 'tasks',
    icon: '⚡',
    description:
      'In-process event bus with subscriptions, durable-style event records, replay, and dead-letter semantics',
    status: 'stable',
    tags: ['dead-letter', 'events', 'pubsub', 'replay', 'tasks'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: ['free/observability/core', 'free/security/audit_policy'],
    capabilities: [
      'dead_letter',
      'event_publish',
      'event_subscribe',
      'health_checks',
      'replay',
      'tenant_scoped_events',
    ],
    slug: 'free/tasks/event_bus',
  },

  {
    id: 'queue_platform',
    name: 'Queue Platform',
    version: '0.1.13',
    category: 'tasks',
    icon: '⚡',
    description:
      'Tenant-aware durable queue abstraction with retry, delay, dead-letter, and worker leasing',
    status: 'stable',
    tags: ['dead-letter', 'queue', 'retry', 'tasks', 'workers'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: ['free/observability/core', 'free/security/audit_policy'],
    capabilities: [
      'dead_letter_queue',
      'delayed_jobs',
      'durable_queue',
      'health_checks',
      'retry_policy',
      'tenant_scoped_messages',
      'worker_leasing',
    ],
    slug: 'free/tasks/queue_platform',
  },

  {
    id: 'workflow_engine',
    name: 'Workflow Engine',
    version: '0.1.16',
    category: 'tasks',
    icon: '⚡',
    description:
      'Workflow engine scaffolding for triggers, actions, conditions, approvals, schedules, and durable runs',
    status: 'stable',
    tags: ['approvals', 'automation', 'scheduler', 'triggers', 'workflow'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: ['free/tasks/celery', 'free/cache/redis', 'free/database/db_postgres'],
    capabilities: [
      'actions',
      'approvals',
      'conditions',
      'scheduled_execution',
      'triggers',
      'workflow_runs',
    ],
    slug: 'free/tasks/workflow_engine',
  },

  // Users Modules
  {
    id: 'users_core',
    name: 'Users Core',
    version: '0.1.16',
    category: 'users',
    icon: '👥',
    description:
      'Opinionated user management backbone that ships immutable domain models, orchestration services, and framework adapters ready for production-grade RapidKit projects.',
    status: 'stable',
    tags: ['application', 'domain', 'users'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: [
      'free/database/db_postgres',
      'free/essentials/settings',
      'free/security/security_headers',
    ],
    capabilities: ['cross_framework', 'http_apis', 'user_directory', 'user_lifecycle'],
    slug: 'free/users/users_core',
  },

  {
    id: 'users_profiles',
    name: 'Users Profiles',
    version: '0.1.16',
    category: 'users',
    icon: '👥',
    description:
      'Extends the Users Core module with rich profile modelling, marketing preferences, and privacy-aware APIs for FastAPI and NestJS applications.',
    status: 'stable',
    tags: ['personalization', 'user_profiles', 'users'],
    frameworks: ['fastapi', 'nestjs'],
    dependencies: ['free/users/users_core', 'free/essentials/settings'],
    capabilities: ['cross_framework', 'http_apis', 'personalization', 'user_profiles'],
    slug: 'free/users/users_profiles',
  },
];

export const CATEGORY_INFO = {
  ai: { name: 'AI', color: '#9B59B6', icon: '🤖' },
  auth: { name: 'Authentication', color: '#F59E0B', icon: '🔐' },
  billing: { name: 'Billing', color: '#E91E63', icon: '💳' },
  business: { name: 'Business', color: '#FF6B6B', icon: '💼' },
  cache: { name: 'Cache', color: '#CB3837', icon: '🔴' },
  communication: { name: 'Communication', color: '#4ECDC4', icon: '📧' },
  database: { name: 'Database', color: '#3775A9', icon: '🗄️' },
  essentials: { name: 'Essentials', color: '#2196F3', icon: '🏗️' },
  observability: { name: 'Observability', color: '#10B981', icon: '📊' },
  security: { name: 'Security', color: '#F59E0B', icon: '🛡️' },
  tasks: { name: 'Tasks', color: '#8E44AD', icon: '⚡' },
  users: { name: 'Users', color: '#3498DB', icon: '👥' },
};

export function getModulesByCategory(category: string): ModuleData[] {
  if (category === 'all') {
    return MODULES;
  }
  return MODULES.filter((m) => m.category === category);
}

export function getCategories(): string[] {
  return Array.from(new Set(MODULES.map((m) => m.category)));
}

export function getTotalModuleCount(): number {
  return MODULES.length;
}
