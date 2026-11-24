import {
  defaultKitForFramework,
  inferCreationNames,
  inferFrameworkFromCreationPrompt,
  inferPolyglotCompanionProject,
  inferWorkspaceProfileFromCreationPrompt,
  type AICreateProfile,
  type CreationStackIntent,
} from './creationStackIntent';
import { type ScaffoldFramework } from './scaffoldKits';
import { isModuleCapableKit } from './aiCoreModuleCatalog';
import { MODULES } from '../data/modules';

type HeuristicModuleRule = {
  slug: string;
  keywords: string[];
};

const MODULE_RULES: HeuristicModuleRule[] = [
  { slug: 'free/auth/core', keywords: ['auth', 'login', 'jwt', 'session', 'user management'] },
  { slug: 'free/auth/oauth', keywords: ['oauth', 'social login', 'google login', 'github login'] },
  {
    slug: 'free/database/db_postgres',
    keywords: ['postgres', 'postgresql', 'relational', 'sql database'],
  },
  { slug: 'free/database/db_mongo', keywords: ['mongo', 'mongodb', 'document store'] },
  { slug: 'free/cache/redis', keywords: ['redis', 'cache'] },
  {
    slug: 'free/billing/stripe_payment',
    keywords: ['stripe', 'payment', 'billing', 'subscription', 'saas'],
  },
  { slug: 'free/communication/email', keywords: ['email', 'smtp', 'mail'] },
  { slug: 'free/communication/notifications', keywords: ['notification', 'push', 'alert'] },
  { slug: 'free/ai/ai_assistant', keywords: ['ai', 'llm', 'gpt', 'chatbot', 'assistant', 'rag'] },
  { slug: 'free/business/storage', keywords: ['upload', 'file storage', 's3', 'blob'] },
  { slug: 'free/users/users_core', keywords: ['users', 'profiles', 'accounts'] },
  {
    slug: 'free/business/feature_flags',
    keywords: ['feature flag', 'feature flags', 'rollout gates'],
  },
  {
    slug: 'free/security/rate_limiting',
    keywords: ['rate limiting', 'rate limit', 'rate-limit', 'throttling'],
  },
  { slug: 'free/security/cors', keywords: ['cors', 'cross-origin'] },
  { slug: 'free/essentials/logging', keywords: ['logging', 'observability', 'metrics', 'tracing'] },
];

const STORE_REQUEST =
  /\b(?:online shop|online store|e-commerce|ecommerce|storefront)\b|\u0641\u0631\u0648\u0634\u06af\u0627\u0647/u;

function inferSuggestedModules(promptLower: string, kit: string): string[] {
  if (
    !isModuleCapableKit(kit) ||
    /\b(?:without|no) (?:optional |catalog )?modules\b/.test(promptLower)
  ) {
    return [];
  }
  const modules = new Set(
    MODULES.filter(({ slug }) => promptLower.includes(slug)).map(({ slug }) => slug)
  );
  if (STORE_REQUEST.test(promptLower)) {
    modules.add('free/billing/cart');
    modules.add('free/billing/inventory');
  }
  for (const rule of MODULE_RULES) {
    if (rule.keywords.some((keyword) => new RegExp(`\\b${keyword}\\b`, 'i').test(promptLower))) {
      modules.add(rule.slug);
    }
  }

  if (
    ![...modules].some((slug) => slug.startsWith('free/database/')) &&
    (promptLower.includes('database') ||
      promptLower.includes('persist') ||
      promptLower.includes('store data'))
  ) {
    modules.add('free/database/db_postgres');
  }

  return [...modules];
}

export function buildHeuristicCreationDraft(
  prompt: string,
  mode: 'workspace' | 'project',
  frameworkHint?: string,
  stackIntent?: CreationStackIntent
): {
  type: 'workspace' | 'project';
  workspaceName: string;
  profile: AICreateProfile;
  installMethod: 'auto';
  framework: ScaffoldFramework;
  kit: string;
  projectName: string;
  suggestedModules: string[];
  description: string;
  secondaryProject?: {
    framework: ScaffoldFramework;
    kit: string;
    projectName: string;
    suggestedModules: string[];
  };
} {
  const trimmedPrompt = prompt.trim();
  const promptLower = trimmedPrompt.toLowerCase();
  const framework = inferFrameworkFromCreationPrompt(promptLower, frameworkHint, stackIntent);
  const names = inferCreationNames(trimmedPrompt, framework);
  const kit = defaultKitForFramework(framework, promptLower);
  const secondaryProject = inferPolyglotCompanionProject(trimmedPrompt, framework, stackIntent);

  return {
    type: mode,
    workspaceName: names.workspaceName,
    profile: inferWorkspaceProfileFromCreationPrompt(
      framework,
      promptLower,
      stackIntent,
      secondaryProject?.framework,
      kit,
      secondaryProject?.kit
    ),
    installMethod: 'auto',
    framework,
    kit,
    projectName: names.projectName,
    suggestedModules: inferSuggestedModules(promptLower, kit),
    description: trimmedPrompt.slice(0, 240),
    secondaryProject: secondaryProject
      ? {
          ...secondaryProject,
          suggestedModules: inferSuggestedModules(promptLower, secondaryProject.kit),
        }
      : undefined,
  };
}
