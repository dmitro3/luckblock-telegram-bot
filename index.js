import dotenv from 'dotenv';
dotenv.config();

import fetch from 'node-fetch';
import TelegramBot from 'node-telegram-bot-api';

import { aveta } from 'aveta';

import { EventEmitter } from 'node:events';

import markdownEscape from 'markdown-escape';

const token = process.env.BOT_TOKEN;

const bot = new TelegramBot(token, {
    polling: true
});

bot.onText(/\/start/, (msg) => {

    const chatId = msg.chat.id;
    bot.sendMessage(chatId, '⚡ Welcome to the BlackRover Telegram bot! ⚡\n\nUse /audit {address} to get an AI-powered audit for any token!');

});

const fetchMarketData = (token) => {
    return fetch(`https://dapp.herokuapp.com/token-market-data?contract=${token}`)
        .then((data) => data.json());
}

const fetchTokenData = (token) => {
    return fetch(`https://dapp.herokuapp.com/token-audit?contract=${token}`)
        .then((data) => data.json());
}

const triggerAudit = (token) => {
    return fetch(`https://api.miyamotoproject.org/audit/${token}`)
        .then((data) => data.json());
}

const fetchAuditStatus = (token) => {
    return fetch(`https://api.miyamotoproject.org/audit/${token}/status`)
        .then((data) => data.json());
}

const fetchAuditData = (token) => {
    return fetch(`https://api.miyamotoproject.org/audit/${token}/json`)
        .then((data) => data.json());
}

const getMOTOMessage = async (eventEmitter, contractAddress) => {

    console.log(contractAddress);

    const tData = await fetchTokenData(contractAddress).catch(() => null);
    console.log(tData);
    if (!tData || !tData.token_name) {
        return eventEmitter.emit('error', 'Could not fetch data');
    }

    eventEmitter.emit('send-message', `🤖 Analyzing ${tData.token_name}...`);

    const data = await fetchMarketData(contractAddress).catch(() => null);
    console.log(data);

    triggerAudit(contractAddress);

    const marketCap = aveta(data.circSupply * data.price_usd, {
        digits: 5
    });

    const usdPrice = aveta(data.price_usd, {
        digits: 5
    });

    const ethPrice = aveta(data.price_eth, {
        digits: 5
    });

    const holderCount = aveta(data.holder_count, {
        digits: 2
    });

    const liquidity = aveta(data.liquidity_usd, {
        digits: 4
    });

    const lastDayVolume = aveta(data.volume_24h_usd, {
        digits: 5
    });
    
    const circSupply = aveta(data.circSupply, {
        digits: 5
    });

    let message = `  
*$${tData.token_name} Token Stats*

🛒 *Total Supply:* $10bn
🏦 *Circ. Supply:* $${circSupply}
💰 *Marketcap:* $${marketCap}
💸 *Price:* $${usdPrice}
📊 *Volume:* $${lastDayVolume}
🔐 *Liquidity:* $${liquidity}
👥 *Holders:* ${holderCount}
`.trim();


    let interval = setInterval(async () => {
        fetchAuditStatus(contractAddress)
        .then(async (data) => {
            if (data.status === 'errored') {
                eventEmitter.emit('error', data.error);
                clearInterval(interval);
            }
            if (data.status === 'ended') {
                const d = await fetchAuditData(contractAddress);
                const parsedD = JSON.parse(d.data);
                message += `

*Audit Results:*

${parsedD.issues?.map((issue, i) => {
    const toEncode = `${contractAddress}/${issue.id}`;
    const encoded = Buffer.from(toEncode).toString('base64');
    return `*Issue #${i+1}*\n\n${markdownEscape(issue.issueExplanation, [
        'number signs',
        'slashes',
        'parentheses',
        'parentheses',
        'square brackets',
        'square brackets',
        'angle brackets',
        'angle brackets'
    ])}\n\n[View recommandation](${process.env.DIFF_VIEWER_URL}#${encoded})`
}).join('\n\n')}

[Download PDF](https://api.miyamotoproject.org/audit/${contractAddress}/direct-pdf)

_Powered by BlockRover._
                `
                eventEmitter.emit('send-message', message);
                clearInterval(interval);
            }
        });
    }, 2000);

    return message;

}

bot.onText(/\/audit/, async (msg, match) => {

    const chatId = msg.chat.id;
    const message = await bot.sendMessage(chatId, 'Loading... (can take a few minutes)');

    const [command, ...args] = match.input.split(' ');

    const ee = new EventEmitter();

    const returnError = () => {
        return bot.editMessageText('🤖 Sorry, I could not find any data for this token!', {
            parse_mode: 'Markdown',
            message_id: message.message_id,
            chat_id: chatId
        });
    }

    getMOTOMessage(ee, args[0])
    .catch((e) => {
        console.error(e);
        returnError();
    });

    ee.on('error', (err) => {
        return void returnError(err);
    });

    ee.on('edit-message', async (message) => {
        await bot.editMessageText(message, {
            parse_mode: 'Markdown',
            message_id: message.message_id,
            chat_id: chatId
        });
    });

    ee.on('send-message', async (message) => {
        console.log(message);
        await bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown'
        }).catch((e) => {});
    });

   
});

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
});


console.log(`🤖 BlackRover bot is started!`);
