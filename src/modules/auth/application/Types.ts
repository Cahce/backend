/**
 * Application layer types for auth module
 */

export interface LoginCommand {
    email: string;
    password: string;
}

export interface LoginResult {
    success: true;
    accessToken: string;
    user: {
        id: string;
        email: string;
        role: "admin" | "student" | "teacher";
    };
}

export interface LoginFailure {
    success: false;
    error: {
        code: string;
        message: string;
    };
}

export type LoginResponse = LoginResult | LoginFailure;
