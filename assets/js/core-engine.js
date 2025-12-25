// core-engine.js - محرك البيانات المركزي (محسّن)
// Emits CustomEvent('bookingsUpdated', { detail: { bookings } }) on changes
class CoreEngine {
    constructor() {
        this.storageKey = 'clinic_bookings_db_v2';
    }

    _loadData() {
        const data = localStorage.getItem(this.storageKey);
        return data ? JSON.parse(data) : [];
    }

    _saveData(arr) {
        localStorage.setItem(this.storageKey, JSON.stringify(arr));
        // notify listeners
        window.dispatchEvent(new CustomEvent('bookingsUpdated', { detail: { bookings: arr } }));
    }

    getAllBookings() {
        return this._loadData();
    }

    // validate booking input, returns { valid: boolean, message?:string }
    validateBooking(booking) {
        if (!booking.name || booking.name.trim().length < 3) return { valid: false, message: 'الاسم غير صالح' };
        // phone format: starting with 7 and total 9 digits (e.g., 7xxxxxxxx)
        const phone = String(booking.phone || '').trim();
        if (!/^7\d{8}$/.test(phone)) return { valid: false, message: 'رقم الهاتف يجب أن يبدأ بـ7 ويحتوي على 9 أرقام' };

        if (!booking.date || !booking.time) return { valid: false, message: 'اختر التاريخ والوقت' };

        const dt = new Date(booking.date + 'T' + booking.time + ':00');
        if (isNaN(dt.getTime())) return { valid: false, message: 'تاريخ/وقت غير صالح' };
        if (dt.getTime() < Date.now() - 1000) return { valid: false, message: 'الوقت يجب أن يكون في المستقبل' };

        // price numeric
        if (!booking.price || isNaN(parseInt(booking.price))) return { valid: false, message: 'السعر غير صالح' };

        return { valid: true };
    }

    // conflict detection: same date + time + service (unless cancelled)
    _findConflict(bookings, bookingData) {
        return bookings.find(b =>
            b.date === bookingData.date &&
            b.time === bookingData.time &&
            b.service === bookingData.service &&
            b.status !== 'cancelled'
        );
    }

    // generate compact unique id
    _generateId() {
        const t = Date.now().toString(36);
        const r = Math.random().toString(36).slice(2, 8);
        return `BK-${t}-${r}`.toUpperCase();
    }

    saveBooking(bookingData) {
        const bookings = this.getAllBookings();
        const validation = this.validateBooking(bookingData);
        if (!validation.valid) return { success: false, message: validation.message };

        // conflict
        const conflict = this._findConflict(bookings, bookingData);
        if (conflict) {
            return { success: false, message: 'عذراً، هذا الموعد محجوز مسبقاً' };
        }

        bookingData.id = this._generateId();
        bookingData.status = 'pending';
        bookingData.createdAt = new Date().toISOString();
        bookingData.price = String(bookingData.price || '0');

        bookings.push(bookingData);
        this._saveData(bookings);
        return { success: true, booking: bookingData };
    }

    updateStatus(id, newStatus) {
        const bookings = this.getAllBookings();
        const index = bookings.findIndex(b => b.id === id);
        if (index !== -1) {
            bookings[index].status = newStatus;
            this._saveData(bookings);
            return true;
        }
        return false;
    }

    updateBooking(id, patch) {
        const bookings = this.getAllBookings();
        const idx = bookings.findIndex(b => b.id === id);
        if (idx === -1) return { success: false, message: 'غير موجود' };

        const updated = { ...bookings[idx], ...patch };

        // validate and conflict check if date/time/service changed
        const validation = this.validateBooking(updated);
        if (!validation.valid) return { success: false, message: validation.message };

        // temporarily remove the original entry to check conflicts
        const others = bookings.filter(b => b.id !== id);
        if (this._findConflict(others, updated)) {
            return { success: false, message: 'تعارض مع حجز آخر' };
        }

        bookings[idx] = updated;
        this._saveData(bookings);
        return { success: true, booking: updated };
    }

    deleteBooking(id) {
        let bookings = this.getAllBookings();
        bookings = bookings.filter(b => b.id !== id);
        this._saveData(bookings);
    }

    // mark as cancelled (soft delete)
    cancelBooking(id) {
        return this.updateStatus(id, 'cancelled');
    }

    // quick stats
    getStats() {
        const all = this.getAllBookings();
        const todayStr = new Date().toISOString().split('T')[0];
        return {
            total: all.length,
            today: all.filter(b => b.date === todayStr).length,
            pending: all.filter(b => b.status === 'pending').length,
            revenue: all.filter(b => b.status === 'completed').reduce((acc, curr) => acc + (parseInt(curr.price) || 0), 0)
        };
    }

    // export CSV (returns string)
    exportCSV() {
        const all = this.getAllBookings();
        if (!all.length) return '';
        const cols = ['id', 'name', 'phone', 'service', 'price', 'date', 'time', 'status', 'createdAt'];
        const rows = [cols.join(',')];
        all.forEach(b => {
            const row = cols.map(c => {
                let v = b[c] ?? '';
                // escape quotes
                v = String(v).replace(/"/g, '""');
                return `"${v}"`;
            }).join(',');
            rows.push(row);
        });
        return rows.join('\n');
    }

    // import JSON array (overwrites if replace=true)
    importFromJSON(jsonStr, replace = false) {
        try {
            const arr = JSON.parse(jsonStr);
            if (!Array.isArray(arr)) return { success: false, message: 'صيغة غير صحيحة' };
            if (replace) {
                this._saveData(arr);
            } else {
                const combined = this.getAllBookings().concat(arr);
                this._saveData(combined);
            }
            return { success: true };
        } catch (e) {
            return { success: false, message: 'خطأ في فك JSON' };
        }
    }

    // seed sample data (only if empty)
    seedSampleData() {
        const arr = this.getAllBookings();
        if (arr.length) return;
        const now = new Date();
        const next = d => {
            const copy = new Date(d);
            copy.setDate(copy.getDate() + 1);
            return copy.toISOString().split('T')[0];
        };
        const sample = [
            { id: this._generateId(), name: 'أحمد محمد', phone: '712345678', service: 'استشارة عامة', price: '150', date: next(now), time: '09:00', status: 'pending', createdAt: new Date().toISOString() },
            { id: this._generateId(), name: 'سارة خالد', phone: '712345679', service: 'فحص أسنان', price: '200', date: next(now), time: '10:00', status: 'confirmed', createdAt: new Date().toISOString() },
            { id: this._generateId(), name: 'يوسف علي', phone: '712345680', service: 'جلدية وليزر', price: '300', date: next(now), time: '11:30', status: 'completed', createdAt: new Date().toISOString() }
        ];
        this._saveData(sample);
    }
}

const engine = new CoreEngine();
// seed if empty for better demo experience
engine.seedSampleData();