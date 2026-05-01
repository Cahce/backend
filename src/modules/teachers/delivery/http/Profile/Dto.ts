import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * Zod schemas for Teacher Profile API
 */

export const FacultySchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const DepartmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  faculty: FacultySchema,
});

export const TeacherProfileSchema = z.object({
  id: z.string(),
  accountId: z.string().nullable(),
  teacherCode: z.string(),
  fullName: z.string(),
  email: z.string().email(),
  role: z.literal("teacher"),
  department: DepartmentSchema,
  academicRank: z.string(),
  academicDegree: z.string(),
  phone: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const GetTeacherProfileResponseSchema = z.object({
  teacher: TeacherProfileSchema,
});

export type GetTeacherProfileResponse = z.infer<
  typeof GetTeacherProfileResponseSchema
>;

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

function unwrapJsonSchema(schema: unknown): Record<string, unknown> {
  const s = schema as Record<string, unknown>;
  if ("$ref" in s && "definitions" in s) {
    const refName = (s.$ref as string).replace("#/definitions/", "");
    const defs = s.definitions as Record<string, unknown>;
    return defs[refName] as Record<string, unknown>;
  }
  const { $schema, ...rest } = s;
  return rest;
}

export const GetTeacherProfileResponseJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(
    GetTeacherProfileResponseSchema as any,
    "GetTeacherProfileResponse",
  ),
);

export const ErrorResponseJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(ErrorResponseSchema as any, "ErrorResponse"),
);
