import dotenv from 'dotenv';
dotenv.config();

import fetch from 'node-fetch';
import TelegramBot from 'node-telegram-bot-api';

import { aveta } from 'aveta';

import { EventEmitter } from 'node:events';

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

const getMOTOMessage = async (eventEmitter, contractAddress) => {

    const data = await fetchMarketData(contractAddress).catch(() => null);
    if (!data) {
        return eventEmitter.emit('error', 'Could not fetch data');
    }

    ee.emit('send-message', `🤖 Analyzing ${data.token_name}...`);

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

    const message = `  
$${data.token_name} Token Stats

🛒 *Total Supply:* $10bn
🏦 *Circ. Supply:* $${circSupply}
💰 *Marketcap:* $${marketCap}
💸 *Price:* $${usdPrice}
📊 *Volume:* $${lastDayVolume}
🔐 *Liquidity:* $${liquidity}
👥 *Holders:* ${holderCount}

app.miyamotoproject.org
`.trim();

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
    .catch(() => {
        returnError();
    });

    ee.on('error', () => {
        return void returnError();
    });

    ee.on('edit-message', async (message) => {
        await bot.editMessageText(message, {
            parse_mode: 'Markdown',
            message_id: message.message_id,
            chat_id: chatId
        });
    });

    ee.on('send-message', async (message) => {
        await bot.sendMessage(message, {
            parse_mode: 'Markdown',
            chat_id: chatId
        });
    });

   
});

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
});


console.log(`🤖 BlackRover bot is started!`);
