
import type { FastifyInstance } from 'fastify';
import type { TemplatesContainer } from '../../Container.js';
import { adminTemplateRoutes } from './Admin/Routes.js';
import { publicTemplateRoutes } from './Public/Routes.js';

export async function registerAdminTemplateRoutes(
  app: FastifyInstance,
  container: TemplatesContainer,
) {
  await adminTemplateRoutes(app, container);
}

export async function registerPublicTemplateRoutes(
  app: FastifyInstance,
  container: TemplatesContainer,
) {
  await publicTemplateRoutes(app, container);
}
