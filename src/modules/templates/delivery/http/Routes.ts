/**
 * Templates Module HTTP Routes
 * 
 * Registers both admin and public template routes.
 */

import type { FastifyInstance } from 'fastify';
import type { TemplatesContainer } from '../../Container.js';
import { adminTemplateRoutes } from './Admin/Routes.js';
import { publicTemplateRoutes } from './Public/Routes.js';

/**
 * Register admin template routes
 * Prefix: /api/v1/admin
 */
export async function registerAdminTemplateRoutes(
  app: FastifyInstance,
  container: TemplatesContainer,
) {
  await adminTemplateRoutes(app, container);
}

/**
 * Register public template routes
 * Prefix: /api/v1
 */
export async function registerPublicTemplateRoutes(
  app: FastifyInstance,
  container: TemplatesContainer,
) {
  await publicTemplateRoutes(app, container);
}
