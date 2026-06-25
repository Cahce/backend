/**
 * Application layer types for auth module
 */

import type { Permission } from "../../../shared/auth/Permissions.js";

export interface LoginCommand {
    email: string;
    password: string;
}

export interface AuthUserView {
    id: string;
    email: string;
    role: "admin" | "student" | "teacher";
    permissions: Permission[];
    mustChangePassword: boolean;
}

export interface LoginResult {
    success: true;
    accessToken: string;
    refreshToken: string;
    user: AuthUserView;
}

export interface LoginFailure {
    success: false;
    error: {
        code: string;
        message: string;
    };
}

export type LoginResponse = LoginResult | LoginFailure;
