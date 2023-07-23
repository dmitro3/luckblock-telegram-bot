import dotenv from 'dotenv';
dotenv.config();

import fetch from 'node-fetch';
import TelegramBot from 'node-telegram-bot-api';

import { EventEmitter } from 'node:events';
import { fetchAuditData, fetchTokenStatistics, formatTokenStatistics, triggerAudit, waitForAuditEndOrError } from 'goplus-ai-analyzer-js';

const token = process.env.BOT_TOKEN;

const bot = new TelegramBot(token, {
    polling: true
});

bot.onText(/\/start/, (msg) => {

    const chatId = msg.chat.id;
    bot.sendMessage(chatId, '🤖 Welcome to the BlockRover Telegram bot! 🤖\n\n/audit - Full analysis of any erc20 smart contract.\n\n/performance - Track the PnL of any wallet (limited to uniswap v2 during BETA mode)\n\n/block0 - First one in, first one out. The fastest DeFi trading bot, guaranteed.\n\n/register - Register your wallet for air drops, early sniper access and more.');

});

// on /performance or /block0, send coming soon

bot.onText(/\/performance/, (msg) => {

    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Coming soon... 🔒');

});

bot.onText(/\/block0/, (msg) => {

    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Coming soon... 🔒');

});

bot.onText(/\/register/, (msg) => {

    const chatId = msg.chat.id;
    const [command, ...args] = msg.text.split(' ');

    if (!args[0]) {
        return bot.sendMessage(chatId, 'Please provide a valid address (e.g. /register 0x1234...)');
    }

    fetch('https://api.blockrover.io/register/' + args[0], {
        method: 'POST'
    });

    bot.sendMessage(chatId, 'Registered Successfully! ✅');
});

bot.onText(/\/audit/, async (msg, match) => {

    const chatId = msg.chat.id;
    const [command, ...args] = match.input.split(' ');
    
    const contractAddress = args[0];

    if (!contractAddress) {
        return bot.sendMessage(chatId, 'Please provide a contract address');
    }

    const message = await bot.sendMessage(chatId, 'Loading insights...');

    const [statistics, initialAuditData] = await Promise.all([
        fetchTokenStatistics(contractAddress),
        fetchAuditData(contractAddress)
    ]);

    if (!statistics) {
        return bot.editMessageText('❌ Oops, something went wrong!', {
            parse_mode: 'Markdown',
            message_id: message.message_id,
            chat_id: chatId
        });
    }

    const initialAuditIsReady = initialAuditData && initialAuditData.status === 'success';
    const statisticsMessage = formatTokenStatistics(statistics, true, initialAuditIsReady ? JSON.parse(initialAuditData?.data) : null);

    await bot.editMessageText(statisticsMessage, {
        parse_mode: 'Markdown',
        message_id: message.message_id,
        chat_id: chatId
    });

    if (!initialAuditIsReady) {

        triggerAudit(contractAddress);

        const ee = new EventEmitter();
        // subscribe to audit changes
        waitForAuditEndOrError(contractAddress, ee);

        const auditGenerationMessage = await bot.sendMessage(chatId, `🔍 (audit generation AI) : starting...`);;

        ee.on('status-update', (status) => {
            bot.editMessageText(`🔍 (audit generation AI): ${status}`, {
                parse_mode: 'Markdown',
                message_id: auditGenerationMessage.message_id,
                chat_id: chatId
            });
        });

        ee.on('end', (audit) => {
            const auditStatisticsMessage = formatTokenStatistics(statistics, true, audit);
            bot.deleteMessage(auditGenerationMessage.chat.id, auditGenerationMessage.message_id);
            bot.editMessageText(auditStatisticsMessage, {
                parse_mode: 'Markdown',
                message_id: message.message_id,
                chat_id: chatId
            });
        });

        ee.on('error', (error) => {
            bot.editMessageText(`❌ Oops, something went wrong! (${error})`, {
                parse_mode: 'Markdown',
                message_id: auditGenerationMessage.message_id,
                chat_id: chatId
            });
        });

    }
   
});

console.log(`🤖 blockrover bot is started!`);

function cleanUpServer() {
    console.log(`🤖 blockrover bot is stopped!`);
    bot.stopPolling({ cancel: true });
    process.exit();
}

process.on('uncaughtException', (err) => {
    console.error(err);
    cleanUpServer();
});

[`exit`, `SIGINT`, `SIGUSR1`, `SIGUSR2`, `SIGTERM`].forEach((eventType) => {
    process.on(eventType, cleanUpServer.bind(null, eventType));
});
