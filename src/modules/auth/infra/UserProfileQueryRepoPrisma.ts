/**
 * Prisma implementation of the user-profile query port.
 *
 * Owns the nested student/teacher profile select. Queries by the unique
 * `email` directly so a single round-trip returns the user + profile (the
 * previous use case did two: findByEmail then a second findUnique by id).
 */

import type { PrismaClient } from "../../../generated/prisma/index.js";
import type { IUserProfileQuery, UserWithProfile } from "../domain/UserProfile.js";

export class UserProfileQueryRepoPrisma implements IUserProfileQuery {
    constructor(private readonly prisma: PrismaClient) {}

    async findByEmailWithProfile(email: string): Promise<UserWithProfile | null> {
        const user = await this.prisma.user.findUnique({
            where: { email },
            select: {
                id: true,
                email: true,
                role: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
                student: {
                    select: {
                        id: true,
                        studentCode: true,
                        fullName: true,
                        phone: true,
                        gender: true,
                        dateOfBirth: true,
                        address: true,
                        class: {
                            select: {
                                id: true,
                                name: true,
                                code: true,
                                major: {
                                    select: {
                                        id: true,
                                        name: true,
                                        code: true,
                                        faculty: {
                                            select: { id: true, name: true, code: true },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                teacher: {
                    select: {
                        id: true,
                        teacherCode: true,
                        fullName: true,
                        phone: true,
                        gender: true,
                        dateOfBirth: true,
                        address: true,
                        academicRank: true,
                        academicDegree: true,
                        department: {
                            select: {
                                id: true,
                                name: true,
                                code: true,
                                faculty: {
                                    select: { id: true, name: true, code: true },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!user) {
            return null;
        }

        const result: UserWithProfile = {
            id: user.id,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };

        if (user.student) {
            result.studentProfile = {
                id: user.student.id,
                studentCode: user.student.studentCode,
                fullName: user.student.fullName,
                phone: user.student.phone,
                gender: user.student.gender,
                dateOfBirth: user.student.dateOfBirth,
                address: user.student.address,
                class: user.student.class,
            };
        }

        if (user.teacher) {
            result.teacherProfile = {
                id: user.teacher.id,
                teacherCode: user.teacher.teacherCode,
                fullName: user.teacher.fullName,
                phone: user.teacher.phone,
                gender: user.teacher.gender,
                dateOfBirth: user.teacher.dateOfBirth,
                address: user.teacher.address,
                academicRank: user.teacher.academicRank,
                academicDegree: user.teacher.academicDegree,
                department: user.teacher.department,
            };
        }

        return result;
    }
}
