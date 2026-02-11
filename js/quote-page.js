// Quote page - customer facing
let quoteData = null;
let cashflowChart = null;
let cumulativeChart = null;

function init() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) { showError(); return; }

    quoteData = DB.trackView(id);
    if (!quoteData) { showError(); return; }

    // Set controls from saved params
    const p = quoteData.params;
    
    // PV system
    setSlider('ctrl-pvdc', 'lbl-pvdc', p.pvDC || 70);
    setSlider('ctrl-pvac', 'lbl-pvac', p.pvAC || 50);
    setSlider('ctrl-pvadd', 'lbl-pvadd', p.pvAdditional || 130);
    setSlider('ctrl-yield', 'lbl-yield', p.pvYield || 1600);
    
    // Storage
    document.getElementById('ctrl-manufacturer').value = p.manufacturer || 'SOLAREDGE';
    setSlider('ctrl-storage', 'lbl-storage', p.storageKwh || 500);
    
    // Financial
    setSlider('ctrl-tariff', 'lbl-tariff', p.pvTariff || 0.42);
    setSlider('ctrl-pvcost', 'lbl-pvcost', p.pvInstallCostPerKwp || 2550);
    setSlider('ctrl-pvmaint', 'lbl-pvmaint', p.pvMaintenancePerKwp || 50);
    setSlider('ctrl-stmaint', 'lbl-stmaint', p.storageMaintenancePerKwh || 5);
    setSlider('ctrl-period', 'lbl-period', p.period || 22);
    
    // Loan
    setSlider('ctrl-loan', 'lbl-loan', p.loanPct || 0);
    setSlider('ctrl-interest', 'lbl-interest', p.interestRate || 7);
    setSlider('ctrl-loanperiod', 'lbl-loanperiod', p.loanPeriod || 20);

    // Hero
    document.getElementById('hero-customer').textContent = quoteData.customer.name;
    document.getElementById('hero-date').textContent = new Date(quoteData.created).toLocaleDateString('he-IL');

    // Set rep info
    const repKey = quoteData.rep || 'default';
    const rep = (typeof REPS !== 'undefined' && REPS[repKey]) || (typeof REPS !== 'undefined' && REPS['default']) || null;
    if (rep) {
        const repNameEl = document.getElementById('rep-name');
        const repPhoneEl = document.getElementById('rep-phone');
        const repWaEl = document.getElementById('rep-whatsapp');
        const repCallEl = document.getElementById('rep-call');
        if (repNameEl) repNameEl.textContent = rep.displayName;
        if (repPhoneEl) repPhoneEl.innerHTML = '<a href="tel:+' + rep.phoneIntl + '">' + rep.phone + '</a>';
        if (repWaEl) repWaEl.href = 'https://wa.me/' + rep.phoneIntl + '?text=' + encodeURIComponent('היי, קיבלתי הצעת מחיר לאגירה ואשמח לפרטים נוספים');
        if (repCallEl) repCallEl.href = 'tel:+' + rep.phoneIntl;
    }

    document.getElementById('loading').classList.add('hidden');
    document.getElementById('quote-app').classList.remove('hidden');

    recalculate();
}

function setSlider(inputId, labelId, value) {
    const el = document.getElementById(inputId);
    el.value = value;
    document.getElementById(labelId).textContent = value;
}

function updateLabel(input, labelId) {
    document.getElementById(labelId).textContent = input.value;
}

function showError() {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('not-found').classList.remove('hidden');
}

function recalculate() {
    if (!quoteData) return;

    const params = {
        pvDC: +document.getElementById('ctrl-pvdc').value,
        pvAC: +document.getElementById('ctrl-pvac').value,
        pvAdditional: +document.getElementById('ctrl-pvadd').value,
        pvYield: +document.getElementById('ctrl-yield').value,
        manufacturer: document.getElementById('ctrl-manufacturer').value,
        storageKwh: +document.getElementById('ctrl-storage').value,
        pvTariff: +document.getElementById('ctrl-tariff').value,
        pvInstallCostPerKwp: +document.getElementById('ctrl-pvcost').value,
        pvMaintenancePerKwp: +document.getElementById('ctrl-pvmaint').value,
        storageMaintenancePerKwh: +document.getElementById('ctrl-stmaint').value,
        period: +document.getElementById('ctrl-period').value,
        loanPct: +document.getElementById('ctrl-loan').value,
        interestRate: +document.getElementById('ctrl-interest').value,
        loanPeriod: +document.getElementById('ctrl-loanperiod').value
    };

    const result = calculateFinancials(params);
    updateSummary(result);
    updateDetails(result, params);
    updateCharts(result);
    updateTable(result);
}

function updateSummary(r) {
    document.getElementById('sum-irr').textContent = r.irr + '%';
    document.getElementById('sum-npv').textContent = formatNIS(r.npv);
    document.getElementById('sum-profit').textContent = formatNIS(r.totalProfit);
    document.getElementById('sum-payback').textContent = r.paybackYear + ' שנים';
}

function updateDetails(r, p) {
    const details = [
        { label: 'יצרן', value: r.manufacturer },
        { label: 'קיבולת בפועל', value: r.actualStorageKwh + ' kWh' },
        { label: 'מספר יחידות', value: r.numUnits },
        { label: 'עלות התקנה כוללת', value: formatNIS(r.totalInstallCost) },
        { label: 'עלות אגירה', value: formatNIS(r.storageCostNIS) },
        { label: 'סכום הלוואה', value: formatNIS(r.loanAmount) },
        { label: 'הון עצמי', value: formatNIS(r.equityAmount) },
        { label: 'החזר הלוואה שנתי', value: formatNIS(r.annualLoanPayment) },
        { label: 'PV מותקן', value: p.pvDC + ' kW DC' },
        { label: 'תקופה', value: r.years + ' שנים' }
    ];
    document.getElementById('system-details').innerHTML = details.map(d =>
        `<div class="detail-item"><div class="label">${d.label}</div><div class="value">${d.value}</div></div>`
    ).join('');
}

function updateCharts(r) {
    const labels = r.cashFlows.map(cf => cf.year);
    const revenues = r.cashFlows.map(cf => cf.revenue);
    const costs = r.cashFlows.map(cf => -(cf.costs + cf.loanPayment));
    const nets = r.cashFlows.map(cf => cf.netCashFlow);
    const cums = r.cashFlows.map(cf => cf.cumulative);

    if (cashflowChart) cashflowChart.destroy();
    cashflowChart = new Chart(document.getElementById('cashflow-chart'), {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'הכנסות', data: revenues, backgroundColor: '#4CAF50' },
                { label: 'הוצאות', data: costs, backgroundColor: '#ef5350' },
                { label: 'נטו', data: nets, type: 'line', borderColor: '#2196F3', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 3 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales: {
                y: { ticks: { callback: v => '₪' + (v/1000).toFixed(0) + 'K' } }
            }
        }
    });

    if (cumulativeChart) cumulativeChart.destroy();
    cumulativeChart = new Chart(document.getElementById('cumulative-chart'), {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'תזרים מצטבר',
                data: cums,
                borderColor: '#2d8a4e',
                backgroundColor: 'rgba(45,138,78,0.1)',
                fill: true,
                borderWidth: 3,
                pointRadius: 4,
                tension: 0.3
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                annotation: { annotations: { zero: { type: 'line', yMin: 0, yMax: 0, borderColor: '#999', borderDash: [5,5] } } }
            },
            scales: {
                y: { ticks: { callback: v => '₪' + (v/1000).toFixed(0) + 'K' } }
            }
        }
    });
}

function updateTable(r) {
    document.getElementById('cashflow-body').innerHTML = r.cashFlows.map(cf => `
        <tr>
            <td>${cf.year}</td>
            <td>${formatNIS(cf.revenue)}</td>
            <td>${formatNIS(cf.costs)}</td>
            <td>${formatNIS(cf.loanPayment)}</td>
            <td style="color:${cf.netCashFlow >= 0 ? '#2d8a4e' : '#e53935'};font-weight:600">${formatNIS(cf.netCashFlow)}</td>
            <td style="color:${cf.cumulative >= 0 ? '#2d8a4e' : '#e53935'};font-weight:600">${formatNIS(cf.cumulative)}</td>
        </tr>
    `).join('');
}

// Init on load
window.addEventListener('DOMContentLoaded', init);
