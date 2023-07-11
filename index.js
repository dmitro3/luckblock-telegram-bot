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
    bot.sendMessage(chatId, '🤖 Welcome to the BlockRover Telegram bot! 🤖\n\nUse /audit {address} to get an AI-powered audit for any ERC20 token!');

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
    return fetch(`https://api.miyamotoproject.org/audit/${token}`, {
        method: 'POST'
    })
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

    const formatData = (name, formattedValue, isPositive) => `*${name}:* ${formattedValue} ${isPositive ? '✅' : '❌'}`;

    const securityProperties = [
        {'prop': 'is_open_source', 'parse_value': (value) => !!parseInt(value), 'is_positive': (value) => value, 'format_value': (value) => value ? 'Yes' : 'No', 'display_name': 'Open Source'},
        {'prop': 'is_proxy', 'parse_value': (value) => !!parseInt(value), 'is_positive': (value) => !value, 'format_value': (value) => value ? 'Yes' : 'No', 'display_name': 'Proxy'},
        {'prop': 'is_mintable', 'parse_value': (value) => !!parseInt(value), 'is_positive': (value) => !value, 'format_value': (value) => value ? 'Yes' : 'No', 'display_name': 'Mintable'},
        {'prop': 'can_take_back_ownership', 'parse_value': (value) => !!parseInt(value), 'is_positive': (value) => !value, 'format_value': (value) => value ? 'Yes' : 'No', 'display_name': 'Take Back Ownership'},
        {'prop': 'owner_address', 'parse_value': (value) => !!parseInt(value), 'is_positive': (value) => value, 'format_value': (value) => value || 'Unknown', 'display_name': 'Owner Address'},
        {'prop': 'owner_change_balance', 'parse_value': (value) => !!parseInt(value), 'is_positive': (value) => !value, 'format_value': (value) => value ? 'Yes' : 'No', 'display_name': 'Owner Change Balance'},
        {'prop': 'hidden_owner', 'parse_value': (value) => !!parseInt(value), 'is_positive': (value) => !value, 'format_value': (value) => value ? 'Yes' : 'No', 'display_name': 'Hidden Owner'},
        {'prop': 'selfdestruct', 'parse_value': (value) => !!parseInt(value), 'is_positive': (value) => !value, 'format_value': (value) => value ? 'Yes' : 'No', 'display_name': 'Self-destruct'},
        {'prop': 'external_call', 'parse_value': (value) => !!parseInt(value), 'is_positive': (value) => !value, 'format_value': (value) => value ? 'Yes' : 'No', 'display_name': 'External Call'},
    ];

    const goPlusSecurityMessage = securityProperties.map((item) => {
        const prop = tData[item.prop];
        const value = item.parse_value(prop);
        const isPositive = item.is_positive(value);
        const formattedValue = item.format_value(value);
        return formatData(item.display_name, formattedValue, isPositive);
    }).join('\n');

    message += `

*$${tData.token_name} Token Contract Security*

${goPlusSecurityMessage}`;


    const tradingSecurityProperties = [
        {'prop': 'buy_tax', 'parse_value': (value) => parseFloat(value), 'is_positive': (value) => value === 0, 'format_value': (value) => value ? `${value*100}%` : 'Unknown', 'display_name': 'Buy Tax'},
        {'prop': 'sell_tax', 'parse_value': (value) => parseFloat(value), 'is_positive': (value) => value === 0, 'format_value': (value) => value ? `${value*100}%` : 'Unknown', 'display_name': 'Sell Tax'},
        {'prop': 'cannot_buy', 'parse_value': (value) => !!parseInt(value), 'is_positive': (value) => !value, 'format_value': (value) => value ? 'Yes' : 'No', 'display_name': 'Cannot be Bought'},
        {'prop': 'cannot_sell_all', 'parse_value': (value) => !!parseInt(value), 'is_positive': (value) => !value, 'format_value': (value) => value ? 'Yes' : 'No', 'display_name': 'Cannot Sell All'},
        {'prop': 'slippage_modifiable', 'parse_value': (value) => !!parseInt(value), 'is_positive': (value) => !value, 'format_value': (value) => value ? 'Yes' : 'No', 'display_name': 'Modifiable Tax'},
        {'prop': 'is_honeypot', 'parse_value': (value) => !!parseInt(value), 'is_positive': (value) => !value, 'format_value': (value) => value ? 'Yes' : 'No', 'display_name': 'Honeypot'},
        {'prop': 'transfer_pausable', 'parse_value': (value) => !!parseInt(value), 'is_positive': (value) => !value, 'format_value': (value) => value ? 'Yes' : 'No', 'display_name': 'Pausable Transfer'},
        {'prop': 'is_blacklisted', 'parse_value': (value) => !!parseInt(value), 'is_positive': (value) => !value, 'format_value': (value) => value ? 'Yes' : 'No', 'display_name': 'Blacklist'},
        {'prop': 'is_whitelisted', 'parse_value': (value) => !!parseInt(value), 'is_positive': (value) => !value, 'format_value': (value) => value ? 'Yes' : 'No', 'display_name': 'Whitelist'},
        {'prop': 'is_in_dex', 'parse_value': (value) => !!parseInt(value), 'is_positive': (value) => value, 'format_value': (value) => value ? 'Yes' : 'No', 'display_name': 'In main Dex'},
        {'prop': 'is_anti_whale', 'parse_value': (value) => !!parseInt(value), 'is_positive': (value) => !value, 'format_value': (value) => value ? 'Yes' : 'No', 'display_name': 'Anti Whale'},
        {'prop': 'anti_whale_modifiable', 'parse_value': (value) => !!parseInt(value), 'is_positive': (value) => !value, 'format_value': (value) => value ? 'Yes' : 'No', 'display_name': 'Modifiable anti whale'},
        {'prop': 'trading_cooldown', 'parse_value': (value) => !!parseInt(value), 'is_positive': (value) => !value, 'format_value': (value) => value ? 'Yes' : 'No', 'display_name': 'Trading Cooldown'},
        {'prop': 'personal_slippage_modifiable', 'parse_value': (value) => !!parseInt(value), 'is_positive': (value) => !value, 'format_value': (value) => value ? 'Yes' : 'No', 'display_name': 'Personal Slippage Modifiable'},
    ];

    const goPlusTradingSecurityMessage = tradingSecurityProperties.map((item) => {
        const prop = tData[item.prop];
        const value = item.parse_value(prop);
        const isPositive = item.is_positive(value);
        const formattedValue = item.format_value(value);
        return formatData(item.display_name, formattedValue, isPositive);
    }).join('\n');

    message += `

*$${tData.token_name} Token Trading Security*

${goPlusTradingSecurityMessage}`;

    
    let lastStatus = null;

    let interval = setInterval(async () => {
        fetchAuditStatus(contractAddress)
        .then(async (data) => {
            if (data.status === 'errored' || data.status === 'unknown') {
                eventEmitter.emit('send-message', '❌ ' + data.error || 'Oops, something went wrong!');
                clearInterval(interval);
            }
            else if (data.status === 'ended') {
                const d = await fetchAuditData(contractAddress);
                console.log(d)
                const parsedD = JSON.parse(d.data);
                message += `

*$${tData.token_name} AI Audit*

${parsedD.issues?.map((issue, i) => {
    return `*Issue #${i+1}*\n\n${markdownEscape(issue.issueExplanation, [
        'number signs',
        'slashes',
        'parentheses',
        'parentheses',
        'square brackets',
        'square brackets',
        'angle brackets',
        'angle brackets'
    ])}\n\n[View recommendation](${issue.issueCodeDiffUrl})`
}).join('\n\n')}

[Download PDF](https://api.miyamotoproject.org/audit/${contractAddress}/direct-pdf)

_Powered by BlockRover._
                `
                eventEmitter.emit('send-message', message);
                clearInterval(interval);
            }
            else if (data.status !== lastStatus) {
                eventEmitter.emit('send-message', `🤖 Analyzing ${tData.token_name}... (${data.status})`);
                lastStatus = data.status;
            }
        });
    }, 2000);

    return message;

}

bot.onText(/\/audit/, async (msg, match) => {

    const chatId = msg.chat.id;
    const [command, ...args] = match.input.split(' ');

    if (!args[0]) {
        return bot.sendMessage(chatId, 'Please provide a contract address');
    }

    const message = await bot.sendMessage(chatId, 'Loading... (can take a few minutes)');

    const ee = new EventEmitter();

    getMOTOMessage(ee, args[0])
    .catch((e) => {
        console.error(e);
        return ee.emit('error', '❌ Oops, something went wrong!');
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


console.log(`🤖 blockrover bot is started!`);

function cleanUpServer() {
    console.log(`🤖 blockrover bot is stopped!`);
    bot.stopPolling();
}

[`exit`, `SIGINT`, `SIGUSR1`, `SIGUSR2`, `uncaughtException`, `SIGTERM`].forEach((eventType) => {
    process.on(eventType, cleanUpServer.bind(null, eventType));
});
