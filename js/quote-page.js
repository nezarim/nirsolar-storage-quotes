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
    document.getElementById('ctrl-manufacturer').value = p.manufacturer;
    setSlider('ctrl-storage', 'lbl-storage', p.storageKwh);
    setSlider('ctrl-period', 'lbl-period', p.period);
    setSlider('ctrl-loan', 'lbl-loan', p.loanPct);
    setSlider('ctrl-interest', 'lbl-interest', p.interestRate);

    // Hero
    document.getElementById('hero-customer').textContent = quoteData.customer.name;
    document.getElementById('hero-date').textContent = new Date(quoteData.created).toLocaleDateString('he-IL');

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
        pvDC: quoteData.params.pvDC,
        pvAC: quoteData.params.pvAC,
        pvAdditional: quoteData.params.pvAdditional,
        manufacturer: document.getElementById('ctrl-manufacturer').value,
        storageKwh: +document.getElementById('ctrl-storage').value,
        pvTariff: +document.getElementById('ctrl-tariff').value,
        period: +document.getElementById('ctrl-period').value,
        loanPct: +document.getElementById('ctrl-loan').value,
        interestRate: +document.getElementById('ctrl-interest').value,
        loanPeriod: quoteData.params.loanPeriod
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
