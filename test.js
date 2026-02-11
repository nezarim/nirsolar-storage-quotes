const playwright = require('playwright');

(async () => {
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext({ locale: 'he-IL' });
    const page = await context.newPage();

    console.log('📄 Testing Nir Solar Quote System...\n');

    // 1. Login
    console.log('1️⃣ Login page');
    await page.goto('http://localhost:8888/');
    await page.waitForTimeout(500);
    await page.screenshot({ path: '/tmp/nirsolar-01-login.png', fullPage: true });
    
    await page.fill('#rep-name', 'admin');
    await page.fill('#rep-pass', 'admin');
    await page.click('text=כניסה');
    await page.waitForTimeout(1000);

    // 2. Dashboard
    console.log('2️⃣ Dashboard');
    await page.screenshot({ path: '/tmp/nirsolar-02-dashboard.png', fullPage: true });

    // 3. New quote form
    console.log('3️⃣ New quote form');
    await page.click('text=הצעה חדשה');
    await page.waitForTimeout(500);
    await page.screenshot({ path: '/tmp/nirsolar-03-form-empty.png', fullPage: true });

    // Fill form
    await page.fill('#q-name', 'לקוח בדיקה');
    await page.fill('#q-company', 'חברת בדיקה בע"מ');
    await page.fill('#q-phone', '0501234567');
    await page.screenshot({ path: '/tmp/nirsolar-04-form-filled.png', fullPage: true });

    // Check that all new fields exist
    const pvDC = await page.inputValue('#q-pv-dc');
    const pvAC = await page.inputValue('#q-pv-ac');
    const pvAdd = await page.inputValue('#q-pv-add');
    const pvYield = await page.inputValue('#q-pv-yield');
    const pvTariff = await page.inputValue('#q-pv-tariff');
    const pvCost = await page.inputValue('#q-pv-cost');
    const pvMaint = await page.inputValue('#q-pv-maint');
    const stMaint = await page.inputValue('#q-st-maint');
    const loanPeriod = await page.inputValue('#q-loan-period');

    console.log('✅ All new fields present:');
    console.log(`   PV DC קיים: ${pvDC} kWp`);
    console.log(`   AC PV קיים: ${pvAC} kW`);
    console.log(`   PV DC נוסף: ${pvAdd} kWp`);
    console.log(`   תפוקה שנתית: ${pvYield} kWh/kWp`);
    console.log(`   תעריף אסדרה: ${pvTariff} ₪/kWh`);
    console.log(`   עלות הקמה PV: ${pvCost} ₪/kWp`);
    console.log(`   תחזוקה PV: ${pvMaint} ₪/kWp/year`);
    console.log(`   תחזוקה אגירה: ${stMaint} ₪/kWh/year`);
    console.log(`   תקופת הלוואה: ${loanPeriod} שנים\n`);

    // Create quote
    console.log('4️⃣ Creating quote...');
    await page.click('text=צור הצעת מחיר');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/nirsolar-05-dashboard-with-quote.png', fullPage: true });

    // Get quote ID
    const quoteId = await page.evaluate(() => {
        const data = JSON.parse(localStorage.getItem('nirsolar_quotes') || '[]');
        return data[0]?.id;
    });

    if (quoteId) {
        console.log(`✅ Quote created: ${quoteId}\n`);

        // 5. View quote
        console.log('5️⃣ Viewing quote page...');
        await page.goto(`http://localhost:8888/quote.html?id=${quoteId}`);
        await page.waitForTimeout(2000);
        await page.screenshot({ path: '/tmp/nirsolar-06-quote-top.png', fullPage: false });
        await page.screenshot({ path: '/tmp/nirsolar-07-quote-full.png', fullPage: true });

        // Check controls
        const hasAllControls = await page.evaluate(() => {
            const controls = [
                'ctrl-pvdc', 'ctrl-pvac', 'ctrl-pvadd', 'ctrl-yield',
                'ctrl-manufacturer', 'ctrl-storage',
                'ctrl-tariff', 'ctrl-pvcost', 'ctrl-pvmaint', 'ctrl-stmaint',
                'ctrl-period', 'ctrl-loan', 'ctrl-interest', 'ctrl-loanperiod'
            ];
            return controls.every(id => document.getElementById(id) !== null);
        });

        console.log(hasAllControls ? '✅ All interactive controls present' : '❌ Some controls missing');

        // Get summary values
        const summary = await page.evaluate(() => {
            return {
                irr: document.getElementById('sum-irr')?.textContent,
                npv: document.getElementById('sum-npv')?.textContent,
                profit: document.getElementById('sum-profit')?.textContent,
                payback: document.getElementById('sum-payback')?.textContent
            };
        });

        console.log('\n💰 Financial Summary:');
        console.log(`   IRR: ${summary.irr}`);
        console.log(`   NPV: ${summary.npv}`);
        console.log(`   Profit (25y): ${summary.profit}`);
        console.log(`   Payback: ${summary.payback}\n`);

        console.log('✅ Test complete! Screenshots saved to /tmp/nirsolar-*.png');
    } else {
        console.log('❌ Failed to create quote');
    }

    await browser.close();
})().catch(console.error);
