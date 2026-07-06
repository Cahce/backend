
import type { Major } from '../Major/Types.js';
import type { Faculty } from '../Faculty/Types.js';

export type Class = {
  id: string;
  name: string;
  code: string;
  majorId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ClassWithContext = Class & {
  major?: Major;
  faculty?: Faculty;
};

export type CreateClassData = {
  name: string;
  code: string;
  majorId: string;
};

export type UpdateClassData = {
  name?: string;
  code?: string;
  majorId?: string;
};

export type ClassFilters = {
  search?: string;
  majorId?: string;
  facultyId?: string;
  page?: number;
  pageSize?: number;
};
