// security.js - improved client-side auth using Web Crypto (salted SHA-256)
const SecurityConfig = {
    STORAGE_KEY: 'clinic_admin',        // stores { hash, salt }
    AUTH_KEY: 'clinic_auth_token',
    SESSION_EXP_MS: 1000 * 60 * 60 // 1 hour session
};

class SecurityManager {
    // helper UTF8 encoder
    static _encode(str) {
        return new TextEncoder().encode(str);
    }

    // create a random salt
    static _generateSalt(length = 16) {
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        // convert to hex
        return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // produce hex string hash = SHA-256(password + salt)
    static async _hashPassword(password, salt) {
        const data = SecurityManager._encode(password + salt);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // check whether admin account exists
    static adminExists() {
        return !!localStorage.getItem(SecurityConfig.STORAGE_KEY);
    }

    // initial setup - creates admin password. Returns true on success.
    static async setup(password) {
        if (!password || password.length < 6) throw new Error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
        const salt = SecurityManager._generateSalt();
        const hash = await SecurityManager._hashPassword(password, salt);
        localStorage.setItem(SecurityConfig.STORAGE_KEY, JSON.stringify({ hash, salt }));
        return true;
    }

    // login - checks password against stored hash, sets session token
    static async login(password) {
        const raw = localStorage.getItem(SecurityConfig.STORAGE_KEY);
        if (!raw) return false;
        const { hash, salt } = JSON.parse(raw);
        const candidate = await SecurityManager._hashPassword(password, salt);
        if (candidate === hash) {
            // create session token with expiry
            const payload = {
                t: (Date.now() + SecurityConfig.SESSION_EXP_MS),
                s: Math.random().toString(36).slice(2)
            };
            sessionStorage.setItem(SecurityConfig.AUTH_KEY, btoa(JSON.stringify(payload)));
            return true;
        }
        return false;
    }

    // check session validity
    static isAuthenticated() {
        try {
            const raw = sessionStorage.getItem(SecurityConfig.AUTH_KEY);
            if (!raw) return false;
            const payload = JSON.parse(atob(raw));
            if (payload.t && payload.t > Date.now()) return true;
            // expired
            sessionStorage.removeItem(SecurityConfig.AUTH_KEY);
            return false;
        } catch (e) {
            return false;
        }
    }

    // logout
    static logout() {
        sessionStorage.removeItem(SecurityConfig.AUTH_KEY);
        window.location.href = 'login.html';
    }

    // protect pages: redirect to login if not authenticated
    static init() {
        const protectedPages = ['admin.html', 'dashboard.html', 'report.html'];
        const path = window.location.pathname || window.location.href;
        const needsProtect = protectedPages.some(p => path.includes(p));
        if (needsProtect && !SecurityManager.isAuthenticated()) {
            window.location.href = 'login.html';
        }
    }

    // Optional: change admin password (requires current password verification)
    static async changePassword(currentPassword, newPassword) {
        const ok = await SecurityManager.login(currentPassword);
        if (!ok) return { success: false, message: 'كلمة المرور الحالية غير صحيحة' };
        await SecurityManager.setup(newPassword);
        return { success: true };
    }
}

// Initialize protection
SecurityManager.init();