const puppeteer = require('puppeteer-extra'); // 使用 extra
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');

puppeteer.use(StealthPlugin()); // 启用隐身插件，减少被 CF 识别的概率

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
    headless: "new", // 推荐使用新版 headless 模式
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });
  const page = await browser.newPage();

  // 设置模拟真实用户的 UserAgent
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  try {
    // --- 核心逻辑：注入 COOKIE ---
    const cookieString = process.env.USER_COOKIES;
    if (cookieString) {
      console.log('检测到 Cookie，尝试注入...');
      // 将字符串格式的 Cookie 转换为 Puppeteer 格式
      const cookies = cookieString.split(';').map(pair => {
        const [name, ...value] = pair.trim().split('=');
        return {
          name: name,
          value: value.join('='),
          domain: '.lunes.host', // 替换为目标网站的实际根域名
          path: '/'
        };
      });
      await page.setCookie(...cookies);
    }

    // 访问登录后的主页（而不是登录页）
    // 假设登录后的页面是 /dashboard 或 /clientarea
    await page.goto(process.env.WEBSITE_URL, { waitUntil: 'networkidle2' });

    // 检查是否仍然在登录页面
    const content = await page.content();
    const title = await page.title();
    const currentUrl = page.url();

    // 如果页面标题包含 Login 或 URL 还在 /login，说明 Cookie 失效了
    if (title.includes('Login') || currentUrl.includes('/login')) {
      console.log('Cookie 已失效或未提供，当前页面需要验证。');
      // 这里如果还需要自动化，就只能手动干预或使用付费打码
      throw new Error('Cookie 失效，无法绕过验证码，请更新 USER_COOKIES');
    }

    // 如果通过了，发送成功通知
    await sendTelegramMessage(process.env.TELEGRAM_BOT_TOKEN, process.env.TELEGRAM_CHAT_ID, 
      `*登录成功 (免打码模式)！*\n时间: ${new Date().toLocaleString()}\n页面: ${currentUrl}\n标题: ${title}`);
    
    console.log('登录成功！当前页面：', currentUrl);
    console.log('脚本执行完成。');

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
