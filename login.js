const puppeteer = require('puppeteer'); // 换回基础库，确保 100% 能运行
const axios = require('axios');

async function sendTelegramMessage(botToken, chatId, message) {
  if (!botToken || !chatId) return;
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  await axios.post(url, {
    chat_id: chatId,
    text: message,
    parse_mode: 'Markdown'
  }).catch(error => {
    console.error('Telegram 通知失败:', error.message);
  });
}

async function login() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();

  // 模拟真实浏览器指纹
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  try {
    const cookieString = process.env.USER_COOKIES;
    if (cookieString) {
      const cookies = cookieString.split(';').map(pair => {
        const [name, ...value] = pair.trim().split('=');
        return {
          name: name,
          value: value.join('='),
          domain: '.lunes.host', 
          path: '/'
        };
      });
      await page.setCookie(...cookies);
    }

    // 这里直接去后台页面
    await page.goto(process.env.WEBSITE_URL, { waitUntil: 'networkidle2' });

    const title = await page.title();
    const currentUrl = page.url();

    // 如果没被踢回登录页，就算成功
    if (!title.includes('Login') && !currentUrl.includes('/login')) {
      await sendTelegramMessage(process.env.TELEGRAM_BOT_TOKEN, process.env.TELEGRAM_CHAT_ID, 
        `*登录成功 (免打码模式)！*\n时间: ${new Date().toLocaleString()}\n标题: ${title}`);
      console.log('登录成功！');
    } else {
      throw new Error('Cookie 可能失效了，页面显示为登录页');
    }

  } catch (error) {
    await page.screenshot({ path: 'login-failure.png', fullPage: true });
    await sendTelegramMessage(process.env.TELEGRAM_BOT_TOKEN, process.env.TELEGRAM_CHAT_ID, 
      `*脚本运行失败！*\n原因: ${error.message}`);
    console.error('执行失败：', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

login();
