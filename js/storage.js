// Simple localStorage-based storage
const DB = {
    _key: 'nirsolar_quotes',
    _reps: 'nirsolar_reps',

    init() {
        // Migrate old reps format → new format with profile fields
        const raw = localStorage.getItem(this._reps);
        if (raw) {
            const reps = JSON.parse(raw);
            if (reps.length && !('displayName' in reps[0])) {
                // Old format: [{name, pass}] → add profile fields from legacy REPS
                const legacy = {
                    'admin': { displayName: 'גיל נסהופר', phone: '050-901-4074', phoneIntl: '972509014074' }
                };
                const migrated = reps.map(r => ({
                    name: r.name,
                    pass: r.pass,
                    displayName: (legacy[r.name] && legacy[r.name].displayName) || r.name,
                    phone: (legacy[r.name] && legacy[r.name].phone) || '',
                    phoneIntl: (legacy[r.name] && legacy[r.name].phoneIntl) || ''
                }));
                localStorage.setItem(this._reps, JSON.stringify(migrated));
            }
        } else {
            // First run – seed default admin
            localStorage.setItem(this._reps, JSON.stringify([
                { name: 'admin', pass: 'admin', displayName: 'גיל נסהופר', phone: '050-901-4074', phoneIntl: '972509014074' }
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

    authenticate(name, pass) {
        const reps = this.getReps();
        return reps.find(r => r.name === name && r.pass === pass);
    },

    saveRep(rep) {
        const reps = this.getReps();
        const idx = reps.findIndex(r => r.name === rep.name);
        if (idx >= 0) {
            reps[idx] = rep;
        } else {
            reps.push(rep);
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
    // Fallback default
    if (!REPS['default'] && REPS['admin']) {
        REPS['default'] = REPS['admin'];
    } else if (!REPS['default']) {
        REPS['default'] = { displayName: 'ניר סולאר', role: 'מחלקת אגירה - ניר סולאר', phone: '', phoneIntl: '' };
    }
}

DB.init();
buildRepsLookup();
