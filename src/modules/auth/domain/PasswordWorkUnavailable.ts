export class PasswordWorkUnavailable extends Error {
    readonly code = 'AUTH_BUSY';
    constructor() {
        super('Dịch vụ đăng nhập đang bận. Hãy thử lại sau');
        this.name = 'PasswordWorkUnavailable';
    }
}
