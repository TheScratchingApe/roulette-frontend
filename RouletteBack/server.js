const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3001;

app.use(cors());  // Permettre à tous les domaines d'accéder à l'API

let nextDrawTime = Date.now() + 45000;
let currentNumber = Math.floor(Math.random() * 37);


// Générer un nombre aléatoire pour la roulette toutes les 45 secondes
setInterval(() => {
    currentNumber = Math.floor(Math.random() * 37);
    console.log(`New number generated: ${currentNumber}`);
    nextDrawTime = Date.now() + 45000;  // Update the next draw time
}, 45000);

// Endpoint pour obtenir le dernier nombre généré
app.get('/current-number', (req, res) => {
    const timeRemaining = nextDrawTime - Date.now();
    res.json({ number: currentNumber, timeRemaining: timeRemaining });
});


app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});


