const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  
  await page.goto('http://localhost:5173');
  
  // Wait for load
  await new Promise(r => setTimeout(r, 2000));
  
  // Click Practice tab
  const practiceBtn = await page.$x("//button[contains(text(), 'Practice')]");
  if (practiceBtn.length > 0) {
      await practiceBtn[0].click();
      await new Promise(r => setTimeout(r, 1000));
  } else {
      console.log("Could not find practice button");
  }
  
  await browser.close();
})();
