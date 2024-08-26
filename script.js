let userBalance = 1000;
const balanceDisplay = document.getElementById('player-balance');
const betResultDisplay = document.getElementById('bet-result');
const lastDrawnNumberDisplay = document.getElementById('last-drawn-number');
const currentBetsDisplay = document.getElementById('current-bets');
const timerDisplay = document.getElementById('timer');

let clientNextDrawTime = Date.now() + 45000;  // Initial value, will be updated later
let canBet = true; // Si le joueur peut miser ou non
let bets = [];
let drawnNumbersHistory = [];
let resetBallTimeout;
let lastClickTime = 0;
let currentBetValue = 1; 

let telegramUserId = null;

// Fonction pour récupérer l'UserID au moment du pari
function fetchTelegramUserId() {
    telegramUserId = window.Telegram.WebApp.initDataUnsafe.user ? window.Telegram.WebApp.initDataUnsafe.user.id : null;

    if (!telegramUserId) {
        console.error("Failed to retrieve Telegram user ID.");
    } else {
        console.log("Telegram User ID:", telegramUserId);
    }
}

document.getElementById('cancel-bet-btn').addEventListener('click', function() {
    const currentTime = Date.now();
    if (currentTime - lastClickTime < 300) { // Double click within 300ms
        cancelAllBets();
    } else {
        cancelLastBet();
    }
    lastClickTime = currentTime;
});


function updateTimer() {
    const timeLeft = clientNextDrawTime - Date.now();
    if (timeLeft <= 0) {
        timerDisplay.textContent = "Drawing...";
        timerDisplay.style.color = "red";
    } else if (timeLeft <= 10000) {
        timerDisplay.textContent = `Time left: ${(timeLeft / 1000).toFixed(2)}s`;
        timerDisplay.style.color = "red";
    } else {
        timerDisplay.textContent = `Time left: ${(timeLeft / 1000).toFixed(2)}s`;
        timerDisplay.style.color = "black";
    }
}

function initializeRoulette() {
    fetch('http://localhost:3001/current-number')
        .then(response => response.json())
        .then(data => {
            lastDrawnNumberDisplay.textContent = data.number;
            clientNextDrawTime = Date.now() + data.timeRemaining;
            updateClientTimer();
        })
        .catch(error => {
            console.error("Error fetching current number:", error);
        });
}

function startWheelSpin() {
    const wheel = document.querySelector('.roulette-wheel');
    wheel.classList.add('spinning');
}

function stopWheelSpin() {
    const wheel = document.querySelector('.roulette-wheel');
    wheel.classList.remove('spinning');
}

function resetBallPosition() {
    const ballElement = document.querySelector('.ball');
    if (!ballElement) {
        console.error("Ball element not found!");
        return;
    }

    // Désactivez temporairement la transition
    ballElement.style.transition = "none";

    // Reset the ball's position to the center
    ballElement.style.left = '50%';
    ballElement.style.top = '50%';
    ballElement.style.transform = 'translate(-50%, -50%)'; // to ensure the ball is centered properly
}


function updateClientTimer() {
    setInterval(() => {
        updateTimer();
        const currentTime = Date.now();
        if (currentTime >= clientNextDrawTime - 10000 && currentTime < clientNextDrawTime - 1000) {
            startWheelSpin();
            if (canBet) {
                canBet = false;
                betResultDisplay.textContent = "Bets are now closed for the next draw!";
            }
        } else if (currentTime >= clientNextDrawTime - 1000 && currentTime < clientNextDrawTime) {
            stopWheelSpin();
        } else if (currentTime >= clientNextDrawTime) {
            canBet = true;
            betResultDisplay.textContent = "You can now place your bets for the next draw!";
            fetchDrawnNumber(number => {
                evaluateBets(number);
                bets = [];
                currentBetsDisplay.textContent = '';
            });
        }

        if (currentTime >= clientNextDrawTime - 30000 && currentTime < clientNextDrawTime - 10000) {
            resetBallPosition();
        }
        if (currentTime >= clientNextDrawTime) {
            moveToNumber(lastDrawnNumberDisplay.textContent);
        }
    }, 500);
}

function cancelLastBet() {
    if (!canBet) {
        alert("Bets and bet cancellations are closed for this round. Wait for the next draw.");
        return;
    }

    const lastBet = bets.pop();
    userBalance += lastBet.amount;
    balanceDisplay.textContent = userBalance;

    // Find the bet element and remove its bet-counter
    let betElement = findBetElement(lastBet);
    if (betElement) {
        let counterElement = betElement.querySelector('.bet-counter');
        if (counterElement) {
            counterElement.remove();
        }
    }
}

function cancelAllBets() {
    if (!canBet) {
        alert("Bets and bet cancellations are closed for this round. Wait for the next draw.");
        return;
    }

    let totalRefund = 0;
    bets.forEach(bet => totalRefund += bet.amount);
    userBalance += totalRefund;
    balanceDisplay.textContent = userBalance;

    // Remove all bet-counters
    document.querySelectorAll('.bet-counter').forEach(counter => counter.remove());

    bets = [];
}



function findBetElement(bet) {
    switch(bet.type) {
        case 'number':
            return document.querySelector(`.cell[onclick="placeBet('number', ${bet.value})"]`);
        case 'color':
            return document.querySelector(`.bottom-bet[onclick="placeBet('color', '${bet.value}')"]`);
        case 'parity':
            return document.querySelector(`.bottom-bet[onclick="placeBet('parity', '${bet.value}')"]`);
        case 'half':
            return document.querySelector(`.bottom-bet[onclick="placeBet('half', '${bet.value}')"]`);
        case 'column':
            return document.querySelector(`.column-bet[onclick="placeBet('column', '${bet.value}')"]`);
        case 'row':
            return document.querySelector(`.row-bet[onclick="placeBet('row', '${bet.value}')"]`);
        case 'split':
            if (Array.isArray(bet.value) && bet.value.length >= 2 && bet.value.length <= 6) {
                const betString = bet.value.join(',');
                return document.querySelector(`.cell[onclick="placeBet('split', [${betString}])"]`);
            }
            break;
        default:
            return null;
    }
}

// Fonction à appeler lorsque l'utilisateur place un pari
function placeBetWithUserId(betType, betValue) {
    fetchTelegramUserId();  // Récupérer l'ID utilisateur
    placeBet(betType, betValue);  // Placer le pari
}

function placeBet(betType, betValue) {
    if (!canBet) {
        alert("Bets are closed for this round. Wait for the next draw.");
        return;
    }

    if (!telegramUserId) {
        alert("Unable to place bet. User ID is missing.");
        console.error("Error: telegramUserId is missing");
        return;
    }

    console.log(`Placing bet with userId: ${telegramUserId}`);

    const betAmount = currentBetValue;

    if (userBalance < betAmount) {
        alert('Insufficient balance to place the bet.');
        return;
    }

    userBalance -= betAmount;
    balanceDisplay.textContent = userBalance;

    bets.push({
        type: betType,
        value: betValue,
        amount: betAmount
    });

    let betElement = findBetElement({ type: betType, value: betValue });
    let counterElement = betElement.querySelector('.bet-counter');

    if (!counterElement) {
        counterElement = document.createElement('div');
        counterElement.className = 'bet-counter';
        counterElement.textContent = betAmount.toString();
        betElement.appendChild(counterElement);
        betElement.style.position = 'relative';
    } else {
        counterElement.textContent = (parseInt(counterElement.textContent) + betAmount).toString();
    }

    // Envoi du pari au backend
    fetch('http://localhost:3001/place-bet', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            userId: telegramUserId, // Utilisation de l'ID récupéré
            amount: betAmount,
            number: betType === 'number' ? betValue : null
        })
    })
    .then(response => response.json())
    .then(data => {
        console.log(data.message);
        alert(data.message); // Affiche un message à l'utilisateur
    })
    .catch(error => console.error('Error:', error));
}


function updateDrawnNumbersHistory(drawnNumber) {
    // Ajoute le dernier numéro au début de l'historique
    drawnNumbersHistory.unshift(drawnNumber);

    // Si l'historique dépasse 20 numéros, supprime le dernier
    if (drawnNumbersHistory.length > 20) {
        drawnNumbersHistory.pop();
    }

    // Met à jour le DOM avec l'historique
    let list = document.getElementById('last-drawn-numbers-list');
    list.innerHTML = ''; // Vider la liste actuelle

    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

    for (let number of drawnNumbersHistory) {
        let listItem = document.createElement('li');
        listItem.textContent = number;

        // Ajout des classes de couleur
        if (redNumbers.includes(number)) {
            listItem.classList.add('red');
        } else if (number === 0) {
            listItem.classList.add('green');
        } else {
            listItem.classList.add('black');
        }

        list.appendChild(listItem);
    }
}


function fetchDrawnNumber(callback) {
    fetch('http://localhost:3001/current-number')
        .then(response => response.json())
        .then(data => {
            const drawnNumber = data.number;

            clearTimeout(resetBallTimeout);  // <-- Annule l'ancienne temporisation

            // Move the ball to the drawn number just after updating it
            moveToNumber(drawnNumber);

            
            
            updateDrawnNumbersHistory(drawnNumber); // Met à jour l'historique
            clientNextDrawTime = Date.now() + data.timeRemaining;

            // Update the last drawn number display
            lastDrawnNumberDisplay.textContent = drawnNumber;

            // Supprimez tous les compteurs de paris
            document.querySelectorAll('.bet-counter').forEach(counter => counter.remove());

           setTimeout(() => {
    resetBallPosition();
    setTimeout(() => {
        moveToNumber(drawnNumber);
    }, 100);  // Attendez 100ms après le reset pour déplacer la balle
}, 15000);


            callback(drawnNumber);
        });
}

function moveToNumber(number) {
    number = parseInt(number, 10);
    console.log("moveToNumber called with number:", number);
    let x, y;

    switch (number) {
        case 0: x = 252; y = 82; break;
        case 32: x = 273; y = 89; break;
        case 15: x = 306; y = 94; break;
        case 19: x = 329; y = 104; break;
        case 4: x = 355; y = 124; break;
        case 21: x = 372; y = 142; break;
        case 2: x = 389; y = 161; break;
        case 25: x = 402; y = 188; break;
        case 17: x = 408; y = 216; break;
        case 34: x = 415; y = 242; break;
        case 6: x = 414; y = 269; break;
        case 27: x = 407; y = 298; break;
        case 13: x = 396; y = 327; break;
        case 36: x = 380; y = 347; break;
        case 11: x = 361; y = 371; break;
        case 30: x = 344; y = 387; break;
        case 8: x = 319; y = 400; break;
        case 23: x = 292; y = 409; break;
        case 10: x = 260; y = 416; break;
        case 5: x = 239; y = 411; break;
        case 24: x = 211; y = 412; break;
        case 16: x = 181; y = 401; break;
        case 33: x = 156; y = 388; break;
        case 1: x = 132; y = 374; break;
        case 20: x = 115; y = 346; break;
        case 14: x = 99; y = 325; break;
        case 31: x = 89; y = 297; break;
        case 9: x = 83; y = 272; break;
        case 22: x = 86; y = 241; break;
        case 18: x = 89; y = 216; break;
        case 29: x = 95; y = 187; break;
        case 7: x = 110; y = 168; break;
        case 28: x = 132; y = 145; break;
        case 12: x = 149; y = 126; break;
        case 35: x = 170; y = 107; break;
        case 3: x = 197; y = 99; break;
        case 26: x = 222; y = 92; break;
        default:
            console.error("Unknown number:", number);
            return;
    }

    console.log(`Moving to number ${number} with coordinates (${x}, ${y})`);

    const ballElement = document.querySelector('.ball');
    if (!ballElement) {
        console.error("Ball element not found!");
        return;
    }
  // Réactivez la transition
  ballElement.style.transition = "top 1s, left 1s";

  ballElement.style.left = `${x}px`;
  ballElement.style.top = `${y}px`;
    // Wait for any ongoing transition to complete before starting a new one
    if (ballElement.style.transition) {
        ballElement.addEventListener('transitionend', function() {
            ballElement.style.left = `${x}px`;
            ballElement.style.top = `${y}px`;
        }, { once: true });
    } else {
        ballElement.style.left = `${x}px`;
        ballElement.style.top = `${y}px`;
    }
}

function evaluateBets(drawnNumber) {
    console.log("Evaluating bets for drawn number:", drawnNumber);
    console.log("Current bets:", bets);
    
    let totalWon = 0;
    let winningBets = [];

    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    const blackNumbers = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

    bets.forEach(bet => {
        let winAmount = 0;
        switch (bet.type) {
            case 'number':
                console.log(`Drawn number: ${drawnNumber}, Bet number: ${bet.value}, Type of drawn number: ${typeof drawnNumber}, Type of bet value: ${typeof bet.value}`);
                if (drawnNumber === bet.value) {
                    winAmount = bet.amount * 36;
                    winningBets.push(`Number ${bet.value} (x36)`);
                }
                break;
            
            case 'color':
                if (drawnNumber !== 0) {
                    if (bet.value === 'red' && redNumbers.includes(drawnNumber)) {
                        winAmount = bet.amount * 2;
                        winningBets.push(`Color ${bet.value} (x2)`);
                    } else if (bet.value === 'black' && blackNumbers.includes(drawnNumber)) {
                        winAmount = bet.amount * 2;
                        winningBets.push(`Color ${bet.value} (x2)`);
                    }
                }
                break;
            case 'parity':
                if (drawnNumber !== 0 && ((bet.value === 'even' && drawnNumber % 2 === 0) || (bet.value === 'odd' && drawnNumber % 2 === 1))) {
                    winAmount = bet.amount * 2;
                    winningBets.push(`Parity ${bet.value} (x2)`);
                }
                break;
            case 'half':
                if (bet.value === 'low' ? drawnNumber >= 1 && drawnNumber <= 18 : drawnNumber >= 19 && drawnNumber <= 36) {
                    winAmount = bet.amount * 2;
                    winningBets.push(`Half ${bet.value} (x2)`);
                }
                break;
            case 'dozen':
                if (bet.value === 'first' ? drawnNumber >= 1 && drawnNumber <= 12 : bet.value === 'second' ? drawnNumber >= 13 && drawnNumber <= 24 : drawnNumber >= 25 && drawnNumber <= 36) {
                    winAmount = bet.amount * 3;
                    winningBets.push(`Dozen ${bet.value} (x3)`);
                }
                break;
            case 'column':
                const col1 = [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34];
                const col2 = [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35];
                const col3 = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36];
                if ((bet.value === 'first' && col1.includes(drawnNumber)) || (bet.value === 'second' && col2.includes(drawnNumber)) || (bet.value === 'third' && col3.includes(drawnNumber))) {
                    winAmount = bet.amount * 3;
                    winningBets.push(`Column ${bet.value} (x3)`);
                }
                break;
        }
        
        if(winAmount > 0) {
            totalWon += winAmount;
            userBalance += winAmount;
        }
    });

    console.log("Total won:", totalWon);

    balanceDisplay.textContent = userBalance;

    if (totalWon > 0) {
        betResultDisplay.textContent = `You won ${totalWon} tokens! Winning bets: ${winningBets.join(', ')}.`;
    } else {
        betResultDisplay.textContent = `You lost. The number was ${drawnNumber}.`;
    }
}

document.addEventListener('DOMContentLoaded', (event) => {
    // Votre code d'initialisation ici
    document.querySelectorAll('.token').forEach(token => {
        token.addEventListener('click', function() {
            currentBetValue = parseInt(this.dataset.value);
            console.log("Current bet value set to:", currentBetValue);
        });
    });
});


    balanceDisplay.textContent = userBalance;


fetchDrawnNumber(() => {});
initializeRoulette();
