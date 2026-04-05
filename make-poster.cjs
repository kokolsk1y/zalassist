const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 1100 });
  await page.goto('file:///' + path.resolve('qr-poster.html').replace(/\\/g, '/'));
  await page.screenshot({ path: 'static/qr-poster.png', fullPage: true });
  await browser.close();
  console.log('Poster saved to static/qr-poster.png');
})();
