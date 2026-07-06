import {
    InvalidEmailFormatError,
    UnsupportedEmailDomainError,
} from "./AuthErrors.js";


const STUDENT_DOMAIN = "@e.tlu.edu.vn";
const STAFF_DOMAIN = "@tlu.edu.vn";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class EmailPolicy {
    static validate(email: string): void {
        if (!EMAIL_REGEX.test(email)) {
            throw new InvalidEmailFormatError();
        }

        const lowerEmail = email.toLowerCase();
        const isStudentDomain = lowerEmail.endsWith(STUDENT_DOMAIN);
        const isStaffDomain = lowerEmail.endsWith(STAFF_DOMAIN);

        if (!isStudentDomain && !isStaffDomain) {
            throw new UnsupportedEmailDomainError();
        }
    }

    static normalize(email: string): string {
        return email.toLowerCase().trim();
    }
}
