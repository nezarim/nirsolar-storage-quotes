// Dashboard logic
let currentRep = null;

function login() {
    const name = document.getElementById('rep-name').value.trim();
    const pass = document.getElementById('rep-pass').value;
    const rep = DB.authenticate(name, pass);
    if (rep) {
        currentRep = rep;
        showDashboard();
    } else {
        alert('שם משתמש או סיסמה שגויים');
    }
}

function logout() {
    currentRep = null;
    switchScreen('login-screen');
}

function switchScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function showDashboard() {
    switchScreen('dashboard-screen');
    document.getElementById('welcome-text').textContent = `שלום, ${currentRep.name}`;
    renderQuotes();
}

function showNewQuote() {
    switchScreen('new-quote-screen');
    // Sync loan/equity
    document.getElementById('q-loan-pct').addEventListener('input', function() {
        document.getElementById('q-equity-pct').value = 100 - this.value;
    });
}

function renderQuotes() {
    const quotes = DB.getQuotes();
    const tbody = document.getElementById('quotes-body');
    const noQuotes = document.getElementById('no-quotes');

    const total = quotes.length;
    const viewed = quotes.filter(q => q.views > 0).length;
    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-viewed').textContent = viewed;
    document.getElementById('stat-pending').textContent = total - viewed;

    if (total === 0) {
        tbody.innerHTML = '';
        noQuotes.style.display = 'block';
        return;
    }
    noQuotes.style.display = 'none';

    tbody.innerHTML = quotes.sort((a, b) => new Date(b.created) - new Date(a.created)).map(q => `
        <tr>
            <td>${new Date(q.created).toLocaleDateString('he-IL')}</td>
            <td>${q.customer.name}</td>
            <td>${q.customer.company || '-'}</td>
            <td>${q.customer.phone || '-'}</td>
            <td>${q.params.manufacturer}</td>
            <td>${q.params.storageKwh}</td>
            <td>${q.views || 0}</td>
            <td><span class="badge ${q.views > 0 ? 'badge-viewed' : 'badge-pending'}">${q.views > 0 ? 'נצפה' : 'ממתין'}</span></td>
            <td>
                <button class="btn btn-small btn-primary" onclick="copyLink('${q.id}')">העתק קישור</button>
                <button class="btn btn-small btn-danger" onclick="deleteQuote('${q.id}')">מחק</button>
            </td>
        </tr>
    `).join('');
}

function createQuote() {
    const name = document.getElementById('q-name').value.trim();
    if (!name) { alert('נא להזין שם לקוח'); return; }

    const quote = {
        id: DB.generateId(),
        created: new Date().toISOString(),
        rep: currentRep.name,
        views: 0,
        customer: {
            name,
            company: document.getElementById('q-company').value.trim(),
            phone: document.getElementById('q-phone').value.trim(),
            email: document.getElementById('q-email').value.trim()
        },
        params: {
            pvDC: +document.getElementById('q-pv-dc').value,
            pvAC: +document.getElementById('q-pv-ac').value,
            pvAdditional: +document.getElementById('q-pv-add').value,
            manufacturer: document.getElementById('q-manufacturer').value,
            storageKwh: +document.getElementById('q-storage-kwh').value,
            period: +document.getElementById('q-period').value,
            loanPct: +document.getElementById('q-loan-pct').value,
            interestRate: +document.getElementById('q-interest').value,
            loanPeriod: +document.getElementById('q-loan-period').value
        }
    };

    DB.saveQuote(quote);
    showDashboard();
}

function copyLink(id) {
    const base = window.location.href.replace(/\/[^/]*$/, '/');
    const link = `${base}quote.html?id=${id}`;
    navigator.clipboard.writeText(link).then(() => {
        alert('הקישור הועתק! שלח ללקוח:\n' + link);
    }).catch(() => {
        prompt('העתק את הקישור:', link);
    });
}

function deleteQuote(id) {
    if (confirm('למחוק את ההצעה?')) {
        DB.deleteQuote(id);
        renderQuotes();
    }
}

// Enter key on login
document.getElementById('rep-pass').addEventListener('keypress', e => {
    if (e.key === 'Enter') login();
});
