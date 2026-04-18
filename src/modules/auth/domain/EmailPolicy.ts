import {
    InvalidEmailFormatError,
    UnsupportedEmailDomainError,
} from "./AuthErrors.js";

/**
 * Email validation policy for TLU school domain
 */

const STUDENT_DOMAIN = "@e.tlu.edu.vn";
const STAFF_DOMAIN = "@tlu.edu.vn";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class EmailPolicy {
    /**
     * Validates email format and domain
     * @throws {InvalidEmailFormatError} if email format is invalid
     * @throws {UnsupportedEmailDomainError} if domain is not supported
     */
    static validate(email: string): void {
        // Check basic email format
        if (!EMAIL_REGEX.test(email)) {
            throw new InvalidEmailFormatError();
        }

        // Check domain
        const lowerEmail = email.toLowerCase();
        const isStudentDomain = lowerEmail.endsWith(STUDENT_DOMAIN);
        const isStaffDomain = lowerEmail.endsWith(STAFF_DOMAIN);

        if (!isStudentDomain && !isStaffDomain) {
            throw new UnsupportedEmailDomainError();
        }
    }

    /**
     * Normalizes email to lowercase
     */
    static normalize(email: string): string {
        return email.toLowerCase().trim();
    }
}
