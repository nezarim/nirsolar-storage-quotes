// Simple localStorage-based storage

// ── Password hashing (SHA-256) ──
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const DB = {
    _key: 'nirsolar_quotes',
    _reps: 'nirsolar_reps',

    async init() {
        const raw = localStorage.getItem(this._reps);
        if (raw) {
            const reps = JSON.parse(raw);
            let needsSave = false;

            // Migrate: plain text 'pass' → hashed 'passHash'
            for (let i = 0; i < reps.length; i++) {
                const r = reps[i];
                if (r.pass && !r.passHash) {
                    r.passHash = await hashPassword(r.pass);
                    delete r.pass;
                    needsSave = true;
                }
                // Migrate old format without displayName
                if (!('displayName' in r)) {
                    if (r.name === 'admin') {
                        r.displayName = 'גיל נסהופר';
                        r.phone = '050-901-4074';
                        r.phoneIntl = '972509014074';
                    } else {
                        r.displayName = r.name;
                        r.phone = r.phone || '';
                        r.phoneIntl = r.phoneIntl || '';
                    }
                    needsSave = true;
                }
            }
            if (needsSave) {
                localStorage.setItem(this._reps, JSON.stringify(reps));
            }
        } else {
            // First run – seed default admin with hashed password
            const adminHash = await hashPassword('admin');
            localStorage.setItem(this._reps, JSON.stringify([
                { name: 'admin', passHash: adminHash, displayName: 'גיל נסהופר', phone: '050-901-4074', phoneIntl: '972509014074' }
            ]));
        }

        if (!localStorage.getItem(this._key)) {
            localStorage.setItem(this._key, JSON.stringify([]));
        }
    },

    // ── Rep CRUD ──

    getReps() {
        return JSON.parse(localStorage.getItem(this._reps) || '[]');
    },

    getAllReps() {
        return this.getReps();
    },

    async authenticate(name, pass) {
        const reps = this.getReps();
        const hash = await hashPassword(pass);
        return reps.find(r => r.name === name && r.passHash === hash);
    },

    async saveRep(rep) {
        const reps = this.getReps();
        const idx = reps.findIndex(r => r.name === rep.name);

        // Build storage object (never store plain password)
        const stored = {
            name: rep.name,
            passHash: rep.passHash, // already hashed by caller
            displayName: rep.displayName || '',
            phone: rep.phone || '',
            phoneIntl: rep.phoneIntl || ''
        };

        if (idx >= 0) {
            // Keep existing hash if no new one provided
            if (!stored.passHash) {
                stored.passHash = reps[idx].passHash;
            }
            reps[idx] = stored;
        } else {
            reps.push(stored);
        }
        localStorage.setItem(this._reps, JSON.stringify(reps));
        buildRepsLookup();
    },

    deleteRep(name) {
        const reps = this.getReps().filter(r => r.name !== name);
        localStorage.setItem(this._reps, JSON.stringify(reps));
        buildRepsLookup();
    },

    // ── Quotes ──

    getQuotes() {
        return JSON.parse(localStorage.getItem(this._key) || '[]');
    },

    getQuote(id) {
        return this.getQuotes().find(q => q.id === id);
    },

    saveQuote(quote) {
        const quotes = this.getQuotes();
        const idx = quotes.findIndex(q => q.id === quote.id);
        if (idx >= 0) quotes[idx] = quote;
        else quotes.push(quote);
        localStorage.setItem(this._key, JSON.stringify(quotes));
    },

    deleteQuote(id) {
        const quotes = this.getQuotes().filter(q => q.id !== id);
        localStorage.setItem(this._key, JSON.stringify(quotes));
    },

    trackView(id) {
        const quote = this.getQuote(id);
        if (!quote) return null;
        quote.views = (quote.views || 0) + 1;
        quote.lastViewed = new Date().toISOString();
        if (!quote.firstViewed) quote.firstViewed = quote.lastViewed;
        this.saveQuote(quote);
        return quote;
    },

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
    }
};

// Dynamic REPS lookup built from localStorage
let REPS = {};
function buildRepsLookup() {
    REPS = {};
    const reps = DB.getReps();
    reps.forEach(r => {
        REPS[r.name] = {
            displayName: r.displayName || r.name,
            role: 'מחלקת אגירה - ניר סולאר',
            phone: r.phone || '',
            phoneIntl: r.phoneIntl || ''
        };
    });
    if (!REPS['default'] && REPS['admin']) {
        REPS['default'] = REPS['admin'];
    } else if (!REPS['default']) {
        REPS['default'] = { displayName: 'ניר סולאר', role: 'מחלקת אגירה - ניר סולאר', phone: '', phoneIntl: '' };
    }
}

// Init is async – callers should await DB.ready
DB.ready = DB.init().then(() => buildRepsLookup());
