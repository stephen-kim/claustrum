import express from 'express';
import type { MemoryCoreService } from '../../service/index.js';
import { registerCoreSettingsWorkspaceRoutes } from './core-settings-workspace-routes.js';
import { registerCoreSettingsOidcOutboundRoutes } from './core-settings-oidc-outbound-routes.js';
import { registerCoreSettingsMappingRoutes } from './core-settings-mapping-routes.js';
import { registerCoreSettingsDecisionIntegrationsRoutes } from './core-settings-decision-integrations-routes.js';

export function registerCoreSettingsRoutes(app: express.Express, service: MemoryCoreService): void {
  registerCoreSettingsWorkspaceRoutes(app, service);
  registerCoreSettingsOidcOutboundRoutes(app, service);
  registerCoreSettingsMappingRoutes(app, service);
  registerCoreSettingsDecisionIntegrationsRoutes(app, service);
}
