// Simple localStorage-based storage
const DB = {
    _key: 'nirsolar_quotes',
    _reps: 'nirsolar_reps',

    init() {
        if (!localStorage.getItem(this._reps)) {
            localStorage.setItem(this._reps, JSON.stringify([
                { name: 'admin', pass: 'admin' }
            ]));
        }
        if (!localStorage.getItem(this._key)) {
            localStorage.setItem(this._key, JSON.stringify([]));
        }
    },

    getReps() {
        return JSON.parse(localStorage.getItem(this._reps) || '[]');
    },

    authenticate(name, pass) {
        const reps = this.getReps();
        return reps.find(r => r.name === name && r.pass === pass);
    },

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

// Sales rep profiles
const REPS = {
    'admin': { displayName: 'גיל נסהופר', role: 'מחלקת אגירה - ניר סולאר', phone: '050-901-4074', phoneIntl: '972509014074' },
    'default': { displayName: 'גיל נסהופר', role: 'מחלקת אגירה - ניר סולאר', phone: '050-901-4074', phoneIntl: '972509014074' }
};

DB.init();
