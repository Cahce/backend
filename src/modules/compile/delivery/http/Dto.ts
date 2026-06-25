/**
 * Compile module DTOs
 */

import { z } from 'zod';
import { ZMSG } from '../../../../shared/validation/ZodMessages.js';

export const enqueueCompileBodySchema = z.object({
  entryPath: z.string().min(1, ZMSG.required('Đường dẫn tệp')).optional(),
  format: z.literal('pdf').optional(),
  engine: z.literal('node').optional(),
});

export type EnqueueCompileBody = z.infer<typeof enqueueCompileBodySchema>;

// Wire shape of a single diagnostic
export interface CompileDiagnosticDto {
  severity: 'error' | 'warning' | 'hint' | 'info';
  message: string;
  file?: string;
  range?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  hints?: string[];
}

export interface CompileJobResponse {
  id: string;
  projectId: string;
  entryPath: string;
  status: 'queued' | 'running' | 'success' | 'failed';
  diagnostics: CompileDiagnosticDto[];
  latestArtifactId: string | null;
  createdAt: string;
  updatedAt: string;
}

// JSON schemas for Swagger
export const EnqueueCompileBodyJsonSchema = {
  type: 'object',
  properties: {
    entryPath: {
      type: 'string',
      description: 'Đường dẫn tệp entry (mặc định lấy từ project settings)',
    },
    format: {
      type: 'string',
      enum: ['pdf'],
      description: 'Định dạng đầu ra (mặc định: pdf)',
    },
    engine: {
      type: 'string',
      enum: ['node'],
      description: 'Engine biên dịch (mặc định: node)',
    },
  },
};

export const CompileJobResponseJsonSchema = {
  type: 'object',
  required: ['id', 'projectId', 'entryPath', 'status', 'diagnostics', 'createdAt', 'updatedAt'],
  properties: {
    id: { type: 'string' },
    projectId: { type: 'string' },
    entryPath: { type: 'string' },
    status: {
      type: 'string',
      enum: ['queued', 'running', 'success', 'failed'],
    },
    diagnostics: {
      type: 'array',
      items: {
        type: 'object',
        required: ['severity', 'message'],
        properties: {
          severity: {
            type: 'string',
            enum: ['error', 'warning', 'hint', 'info'],
          },
          message: { type: 'string' },
          file: { type: 'string' },
          range: {
            type: 'object',
            properties: {
              start: {
                type: 'object',
                properties: {
                  line: { type: 'number' },
                  column: { type: 'number' },
                },
              },
              end: {
                type: 'object',
                properties: {
                  line: { type: 'number' },
                  column: { type: 'number' },
                },
              },
            },
          },
          hints: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    },
    latestArtifactId: { type: 'string', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

export const ErrorResponseJsonSchema = {
  type: 'object',
  required: ['error'],
  properties: {
    error: {
      type: 'object',
      required: ['code', 'message'],
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
      },
    },
  },
};
