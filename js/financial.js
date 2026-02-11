// Financial Model for Nir Solar Storage Quotes

const MANUFACTURERS = {
    JINKO:     { unitKwh: 266, usdPerKwh: 220 },
    FFD:       { unitKwh: 233, usdPerKwh: 180 },
    SOLAREDGE: { unitKwh: 197, usdPerKwh: 230 }
};

const USD_TO_NIS = 3.25; // Exchange rate used in Excel model

// ToU Tariffs (low voltage) - ag/kWh (agorot per kWh)
const SEASONS = {
    winter:     { offPeak: 38.62, peak: 102.30, share: 0.1331, peakDays: 90, offPeakOnlyDays: 0,  supplementary: 93.2, peakHours: 450 },
    transition: { offPeak: 37.80, peak: 42.18,  share: 0.4090, peakDays: 99, offPeakOnlyDays: 54, supplementary: 42.0, peakHours: 495 },
    summer:     { offPeak: 44.70, peak: 143.18, share: 0.4579, peakDays: 83, offPeakOnlyDays: 39, supplementary: 134.0, peakHours: 498 }
};

const TOTAL_PEAK_HOURS = 1443;
const LOSS_FACTOR = 0.05;  // J17 in Excel: (1-RTE)/2 where RTE=0.9

const DEFAULTS = {
    pvTariff: 0.42,           // NIS/kWh
    pvYield: 1600,            // kWh/kWp/year
    pvDegradation: 0.005,     // 0.5% per year
    storageDegradation: 0.015,// 1.5% per year
    rte: 0.90,                // Round trip efficiency
    pvInstallCostPerKwp: 2550,// NIS/kWp
    pvMaintenancePerKwp: 50,  // NIS/kWp/year
    storageMaintenancePerKwh: 5, // NIS/kWh/year
    discountRate: 0.06,       // For NPV
    augmentationYear: 15,
    augmentationPct: 0.20,    // 20% capacity addition
    augmentationCostPct: 0.70 // 70% of original cost
};

function calculateFinancials(params) {
    const {
        pvDC = 70,
        pvAC = 50,
        pvAdditional = 130,
        pvYield = DEFAULTS.pvYield,
        manufacturer = 'SOLAREDGE',
        storageKwh = 500,
        pvTariff = DEFAULTS.pvTariff,
        pvInstallCostPerKwp = DEFAULTS.pvInstallCostPerKwp,
        pvMaintenancePerKwp = DEFAULTS.pvMaintenancePerKwp,
        storageMaintenancePerKwh = DEFAULTS.storageMaintenancePerKwh,
        period = 22,
        loanPct = 0,
        interestRate = 7,
        loanPeriod = 20
    } = params;

    const mfr = MANUFACTURERS[manufacturer];
    const totalPvDC = pvDC + pvAdditional;

    // Number of storage units needed (ROUNDDOWN like Excel)
    const numUnits = Math.floor(storageKwh / mfr.unitKwh);
    const actualStorageKwh = numUnits * mfr.unitKwh;

    // Installation costs
    const pvAdditionalCost = pvAdditional * pvInstallCostPerKwp;
    const storageCostUSD = actualStorageKwh * mfr.usdPerKwh;
    const storageCostNIS = storageCostUSD * USD_TO_NIS;
    const totalInstallCost = pvAdditionalCost + storageCostNIS;

    // Financing
    const loanAmount = totalInstallCost * (loanPct / 100);
    const equityAmount = totalInstallCost - loanAmount;
    const monthlyRate = (interestRate / 100) / 12;
    const totalLoanMonths = loanPeriod * 12;
    let annualLoanPayment = 0;
    if (loanAmount > 0 && monthlyRate > 0 && totalLoanMonths > 0) {
        const monthlyPayment = loanAmount * monthlyRate * Math.pow(1 + monthlyRate, totalLoanMonths) / (Math.pow(1 + monthlyRate, totalLoanMonths) - 1);
        annualLoanPayment = monthlyPayment * 12;
    }

    // Storage AC power (approximate: storage kWh / 2 for C/2 rate, capped by pvAC)
    const storageACkW = Math.min(actualStorageKwh / 2, pvAC);

    // Annual calculations
    const years = Math.min(period, 25);
    const cashFlows = [];
    let cumulative = -equityAmount;

    for (let y = 1; y <= years; y++) {
        const pvDegFactor = Math.pow(1 - DEFAULTS.pvDegradation, y - 1);
        const stDegFactor = Math.pow(1 - DEFAULTS.storageDegradation, y - 1);

        // Augmentation at year 15
        let augmentationCost = 0;
        let effectiveStorageKwh = actualStorageKwh * stDegFactor;
        if (y === DEFAULTS.augmentationYear && years > DEFAULTS.augmentationYear) {
            augmentationCost = storageCostNIS * DEFAULTS.augmentationPct * DEFAULTS.augmentationCostPct;
            effectiveStorageKwh += actualStorageKwh * DEFAULTS.augmentationPct;
        }

        // Revenue: peak income per season (using supplementary tariff)
        // Formula from Excel: MIN(dailyCapacity * peakDays * (1-lossFactor), maxACperSeason) * supplementaryTariff
        let peakIncome = 0;
        
        for (const [season, data] of Object.entries(SEASONS)) {
            // Max discharge for this season based on AC power (kW * hours)
            const maxACperSeason = pvAC * data.peakHours;
            
            // Actual discharge: MIN(daily capacity * peak days * efficiency, AC limit)
            const dailyCapacity = effectiveStorageKwh;
            const seasonDischargeKwh = Math.min(
                dailyCapacity * data.peakDays * (1 - LOSS_FACTOR),
                maxACperSeason
            );
            
            // Revenue from supplementary tariff (ag/kWh → NIS/kWh: divide by 100)
            peakIncome += seasonDischargeKwh * (data.supplementary / 100);
        }
        
        // No grid charging cost - all charging comes from PV surplus
        const gridChargingCost = 0;
        
        // Surplus PV sales
        const surplusKwh = totalPvDC * pvYield * pvDegFactor * 0.1; // ~10% surplus estimate
        const surplusIncome = surplusKwh * pvTariff;

        const totalRevenue = peakIncome + surplusIncome;

        // Costs
        const pvMaintenance = totalPvDC * pvMaintenancePerKwp;
        const storageMaintenance = actualStorageKwh * storageMaintenancePerKwh;
        const totalCosts = pvMaintenance + storageMaintenance + gridChargingCost + augmentationCost;

        const loanPayment = y <= loanPeriod ? annualLoanPayment : 0;
        const netCashFlow = totalRevenue - totalCosts - loanPayment;
        cumulative += netCashFlow;

        cashFlows.push({
            year: y,
            revenue: Math.round(totalRevenue),
            costs: Math.round(totalCosts),
            loanPayment: Math.round(loanPayment),
            netCashFlow: Math.round(netCashFlow),
            cumulative: Math.round(cumulative)
        });
    }

    // IRR calculation (Newton's method)
    const irrFlows = [-totalInstallCost, ...cashFlows.map(cf => cf.netCashFlow + cf.loanPayment)];
    const irr = calcIRR(irrFlows);

    // NPV
    const npv = calcNPV(DEFAULTS.discountRate, [-equityAmount, ...cashFlows.map(cf => cf.netCashFlow)]);

    // Payback period
    let paybackYear = null;
    const equityCashFlows = cashFlows;
    let cum = -equityAmount;
    for (const cf of equityCashFlows) {
        const prevCum = cum;
        cum += cf.netCashFlow;
        if (cum >= 0 && paybackYear === null) {
            // Interpolate
            paybackYear = cf.year - 1 + (-prevCum) / cf.netCashFlow;
            break;
        }
    }

    const totalProfit = cashFlows.reduce((s, cf) => s + cf.netCashFlow, 0) - equityAmount;

    return {
        totalInstallCost: Math.round(totalInstallCost),
        storageCostNIS: Math.round(storageCostNIS),
        pvAdditionalCost: Math.round(pvAdditionalCost),
        loanAmount: Math.round(loanAmount),
        equityAmount: Math.round(equityAmount),
        annualLoanPayment: Math.round(annualLoanPayment),
        actualStorageKwh,
        numUnits,
        manufacturer,
        irr: irr ? (irr * 100).toFixed(1) : 'N/A',
        npv: Math.round(npv),
        totalProfit: Math.round(totalProfit),
        paybackYear: paybackYear ? paybackYear.toFixed(1) : 'N/A',
        cashFlows,
        years
    };
}

function calcIRR(cashFlows, guess = 0.1) {
    const maxIter = 100;
    const tol = 1e-6;
    let rate = guess;
    for (let i = 0; i < maxIter; i++) {
        let npv = 0, dnpv = 0;
        for (let t = 0; t < cashFlows.length; t++) {
            const pv = cashFlows[t] / Math.pow(1 + rate, t);
            npv += pv;
            if (t > 0) dnpv -= t * cashFlows[t] / Math.pow(1 + rate, t + 1);
        }
        if (Math.abs(dnpv) < 1e-10) break;
        const newRate = rate - npv / dnpv;
        if (Math.abs(newRate - rate) < tol) return newRate;
        rate = newRate;
    }
    return isFinite(rate) && rate > -1 ? rate : null;
}

function calcNPV(rate, cashFlows) {
    return cashFlows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + rate, t), 0);
}

function formatNIS(num) {
    if (typeof num !== 'number') return num;
    return '₪' + num.toLocaleString('he-IL');
}
