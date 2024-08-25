const express = require('express');
const cors = require('cors');
const { Telegraf, Markup } = require('telegraf');

const app = express();
const bot = new Telegraf('7308382522:AAG_YxxzlXEFkiwO4Xuqe4r8vUNHwLXLNSs');
const PORT = 3001;

app.use(cors());

let players = {};
let nextDrawTime = Date.now() + 45000;
let currentNumber = Math.floor(Math.random() * 37);
const GROUP_CHAT_ID = -1001234567890; // Remplacez par l'ID de votre groupe Telegram
const WEB_APP_URL = "https://yourusername.github.io/your-repository/";

// Fonction pour envoyer des messages de compte à rebours
function sendCountdownMessages() {
    bot.telegram.sendMessage(GROUP_CHAT_ID, "🎯 Draw in 45 seconds", Markup.inlineKeyboard([
        [Markup.button.webApp('Place your bets', WEB_APP_URL)]
    ]));
    setTimeout(() => {
        bot.telegram.sendMessage(GROUP_CHAT_ID, "🎯 Draw in 30 seconds", Markup.inlineKeyboard([
            [Markup.button.webApp('Place your bets', WEB_APP_URL)]
        ]));
    }, 15000); // 30 seconds left
    setTimeout(() => {
        bot.telegram.sendMessage(GROUP_CHAT_ID, "🎯 Draw in 15 seconds", Markup.inlineKeyboard([
            [Markup.button.webApp('Place your bets', WEB_APP_URL)]
        ]));
    }, 30000); // 15 seconds left
}

// Générer un nombre aléatoire pour la roulette toutes les 45 secondes
setInterval(() => {
    currentNumber = Math.floor(Math.random() * 37);
    nextDrawTime = Date.now() + 45000;
    
    let resultMessage = `🎲 **New number drawn**: ${currentNumber}\n`;
    for (let playerId in players) {
        let player = players[playerId];
        if (player.betNumber === currentNumber) {
            let winnings = player.betAmount * 2;
            player.balance += winnings;
            resultMessage += `💰 **${player.name}** won ${winnings} tokens!\n`;
        } else {
            resultMessage += `❌ **${player.name}** lost ${player.betAmount} tokens.\n`;
        }
        player.betAmount = 0;  // Reset bet after the draw
    }
    bot.telegram.sendMessage(GROUP_CHAT_ID, resultMessage, { parse_mode: 'Markdown' });

    // Envoyer les messages de compte à rebours pour le prochain tirage
    sendCountdownMessages();
}, 45000);

// Endpoint pour obtenir le dernier nombre généré
app.get('/current-number', (req, res) => {
    const timeRemaining = nextDrawTime - Date.now();
    res.json({ number: currentNumber, timeRemaining: timeRemaining });
});

// Commande /start pour initialiser l'utilisateur
bot.command('start', (ctx) => {
    const userId = ctx.from.id;
    players[userId] = {
        name: ctx.from.username || ctx.from.first_name,
        balance: 1000,  // Balance de départ
        betAmount: 0,
        betNumber: null
    };
    ctx.reply(`Welcome ${players[userId].name}! Your starting balance is 1000 tokens.`);
});

// Commande /bet pour placer un pari
bot.command('bet', (ctx) => {
    const userId = ctx.from.id;
    const [amount, number] = ctx.message.text.split(' ').slice(1).map(Number);
    
    if (!players[userId]) {
        ctx.reply("Please use the /start command first to begin.");
        return;
    }

    if (amount > players[userId].balance) {
        ctx.reply("You don't have enough tokens to place this bet.");
    } else if (number < 0 || number > 36) {
        ctx.reply("Please place a bet on a number between 0 and 36.");
    } else {
        players[userId].betAmount = amount;
        players[userId].betNumber = number;
        players[userId].balance -= amount;
        ctx.reply(`Bet placed: ${amount} tokens on number ${number}`);
    }
});

// Lancer le serveur
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    bot.launch();
});
