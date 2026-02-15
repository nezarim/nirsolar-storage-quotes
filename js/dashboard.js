// Dashboard logic
let currentRep = null;

async function login() {
    const name = document.getElementById('rep-name').value.trim();
    const pass = document.getElementById('rep-pass').value;
    const rep = await DB.authenticate(name, pass);
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
            pvYield: +document.getElementById('q-pv-yield').value,
            manufacturer: document.getElementById('q-manufacturer').value,
            storageKwh: +document.getElementById('q-storage-kwh').value,
            pvTariff: +document.getElementById('q-pv-tariff').value,
            pvInstallCostPerKwp: +document.getElementById('q-pv-cost').value,
            pvMaintenancePerKwp: +document.getElementById('q-pv-maint').value,
            storageMaintenancePerKwh: +document.getElementById('q-st-maint').value,
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

// ── Reps Management ──

function showRepsScreen() {
    switchScreen('reps-screen');
    renderReps();
}

function renderReps() {
    const reps = DB.getAllReps();
    const tbody = document.getElementById('reps-body');
    tbody.innerHTML = reps.map(r => `
        <tr>
            <td>${r.name}</td>
            <td>${r.displayName || '-'}</td>
            <td>${r.phone || '-'}</td>
            <td>
                <button class="btn btn-small btn-primary" onclick="openRepModal('${r.name}')">עריכה</button>
                <button class="btn btn-small btn-danger" onclick="deleteRepAction('${r.name}')">מחיקה</button>
            </td>
        </tr>
    `).join('');
}

function openRepModal(editName) {
    const modal = document.getElementById('rep-modal');
    const titleEl = document.getElementById('rep-modal-title');
    const nameInput = document.getElementById('rm-name');
    const passInput = document.getElementById('rm-pass');
    const displayInput = document.getElementById('rm-display');
    const phoneInput = document.getElementById('rm-phone');
    const phoneIntlInput = document.getElementById('rm-phone-intl');
    const editingInput = document.getElementById('rm-editing');

    if (editName) {
        const rep = DB.getAllReps().find(r => r.name === editName);
        if (!rep) return;
        titleEl.textContent = 'עריכת נציג';
        nameInput.value = rep.name;
        nameInput.disabled = true;
        passInput.value = '';
        passInput.placeholder = 'השאר ריק לשמור סיסמה קיימת';
        displayInput.value = rep.displayName || '';
        phoneInput.value = rep.phone || '';
        phoneIntlInput.value = rep.phoneIntl || '';
        editingInput.value = editName;
    } else {
        titleEl.textContent = 'נציג חדש';
        nameInput.value = '';
        nameInput.disabled = false;
        passInput.value = '';
        passInput.placeholder = 'סיסמה';
        displayInput.value = '';
        phoneInput.value = '';
        phoneIntlInput.value = '';
        editingInput.value = '';
    }
    modal.classList.remove('hidden');
}

function closeRepModal() {
    document.getElementById('rep-modal').classList.add('hidden');
}

async function saveRepModal() {
    const editingName = document.getElementById('rm-editing').value;
    const name = document.getElementById('rm-name').value.trim();
    const pass = document.getElementById('rm-pass').value;
    const displayName = document.getElementById('rm-display').value.trim();
    const phone = document.getElementById('rm-phone').value.trim();
    const phoneIntl = document.getElementById('rm-phone-intl').value.trim();

    if (!name) { alert('נא להזין שם משתמש'); return; }

    // New rep must have a password
    if (!editingName && !pass) { alert('נא להזין סיסמה'); return; }

    // Check duplicate on new rep
    if (!editingName) {
        const existing = DB.getAllReps().find(r => r.name === name);
        if (existing) { alert('שם משתמש כבר קיים'); return; }
    }

    // Hash password if provided, otherwise null (saveRep keeps existing)
    const passHash = pass ? await hashPassword(pass) : null;

    await DB.saveRep({ name, passHash, displayName, phone, phoneIntl });
    closeRepModal();
    renderReps();
}

function deleteRepAction(name) {
    if (name === 'admin') {
        alert('לא ניתן למחוק את משתמש admin');
        return;
    }
    if (confirm(`למחוק את הנציג "${name}"?`)) {
        DB.deleteRep(name);
        renderReps();
    }
}

// login-card style fix for form
document.querySelector('.login-card form .btn').style.width = '100%';
