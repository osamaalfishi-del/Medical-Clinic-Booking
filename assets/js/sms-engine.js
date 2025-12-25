// sms-engine.js - Simulated SMS engine with async API-like methods.
// Replace the internals with a real API call when integrating to a gateway.
const SMSManager = {
    _logElementId: 'smsLog',

    async notifyBooking(booking) {
        // Simulate async operation
        await new Promise(res => setTimeout(res, 350));
        console.info('SMS: booking created', booking);
        SMSManager._appendLog(`تم إرسال إشعار حجز إلى ${booking.phone} (رقم: ${booking.id})`);
        return true;
    },

    async notifyConfirmation(booking) {
        await new Promise(res => setTimeout(res, 250));
        console.info('SMS: booking confirmed', booking);
        SMSManager._appendLog(`تم إرسال تأكيد للحجز إلى ${booking.phone} (رقم: ${booking.id})`);
        return true;
    },

    _appendLog(msg) {
        try {
            const el = document.getElementById(SMSManager._logElementId);
            if (el) {
                const p = document.createElement('div');
                p.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
                p.style.fontSize = '12px';
                p.style.opacity = 0.9;
                el.prepend(p);
            } else {
                console.log(msg);
            }
        } catch (e) {
            console.log(msg);
        }
    }
};