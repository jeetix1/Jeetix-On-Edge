import Player from './player.js';
import Platform from './platform.js';
import InputHandler from './input.js';
import Coin from './coin.js';
import ScoreManager from './scores.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const GAME_WIDTH = 800; // Viewport width
const GAME_HEIGHT = 600; // Viewport height
canvas.width = GAME_WIDTH;
canvas.height = GAME_HEIGHT;

const GRAVITY = 0.5;
const PLAYER_SPEED = 5;
const JUMP_FORCE = -12;
const TILE_SIZE = 40;

let player;
let platforms = [];
let coins = [];
let finishZone = null;
let inputHandler;
let assets = {};
let audioContext = null;
let jumpSoundBuffer = null;
let soundLoaded = false;
let bgMusicBuffer = null;
let bgMusicSource = null;
let coinSoundBuffer = null;
let coinSoundLoaded = false;

let lastTime = 0;
let currentLevelIndex = 0;
const levelFileNames = ['level_001.csv', 'level_002.csv'];
let gameWon = false;
let newHighScore = false;
let playerStartX, playerStartY;

// NCamera and level dimensions
let cameraX = 0;
let cameraY = 0;
let levelPixelWidth = 0;
let levelPixelHeight = 0;

let startBlockInstance = null;
let finishBlockInstance = null;

async function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = src;
        img.onload = () => resolve(img);
        img.onerror = reject;
    });
}

async function loadSound(url) {
    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        return audioBuffer;
    } catch (error) {
        console.error(`Error loading sound: ${url}`, error);
        return null;
    }
}
async function loadBackgroundMusic(url) {
    const resp = await fetch(url);
    const arr = await resp.arrayBuffer();
    return audioContext.decodeAudioData(arr);
}

function playSound(buffer) {
    if (!audioContext || !buffer) return;
    audioContext.resume().then(() => {
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start(0);
    });
}

function playBackgroundMusic() {
    if (!bgMusicBuffer) return;
    if (bgMusicSource) {
        bgMusicSource.stop();
    }
    bgMusicSource = audioContext.createBufferSource();
    bgMusicSource.buffer = bgMusicBuffer;
    bgMusicSource.loop = true;
    bgMusicSource.connect(audioContext.destination);
    bgMusicSource.start(0);
}


function initAudioAndLoadSound() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (!soundLoaded) {
        loadSound('sound/jump.mp3').then(buf => {
            jumpSoundBuffer = buf;
            soundLoaded = true;
        });
    }
    if (!coinSoundLoaded) {
        loadSound('sound/coin_pickup.mp3').then(buf => {
            coinSoundBuffer = buf;
            coinSoundLoaded = true;
        });
    }
    if (!bgMusicBuffer) {
        loadBackgroundMusic('music/Jeetix_on_edge_theme.mp3').then(buf => {
            bgMusicBuffer = buf;
            playBackgroundMusic();
        });
    }
}

document.addEventListener('click', initAudioAndLoadSound, { once: true });
document.addEventListener('keydown', initAudioAndLoadSound, { once: true });

async function loadLevelCSV(filePath) {
    try {
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`Failed to load level: ${response.statusText}`);
        }
        const csvText = await response.text();
        const rows = csvText.trim().split('\n');
        return rows.map(row => row.split(''));
    } catch (error) {
        console.error(`Error loading or parsing CSV ${filePath}:`, error);
        return null;
    }
}

async function setupLevel(levelIndex) {
    const levelData = await loadLevelCSV(levelFileNames[levelIndex]);
    if (!levelData) {
        ctx.fillStyle = 'red';
        ctx.font = '20px Arial';
        ctx.fillText(`Error loading level ${levelIndex + 1}. Please refresh.`, 50, 100);
        gameWon = true;
        newHighScore = ScoreManager.flush();
        return false;
    }

    platforms = [];
    coins = [];
    finishZone = null;
    startBlockInstance = null;
    finishBlockInstance = null;
    // Score persists between levels

    levelPixelHeight = levelData.length * TILE_SIZE;
    levelPixelWidth = (levelData[0] ? levelData[0].length : 0) * TILE_SIZE;


    levelData.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
            const x = colIndex * TILE_SIZE;
            const y = rowIndex * TILE_SIZE;
            switch (cell) {
                case 'G':
                    platforms.push(new Platform(x, y, TILE_SIZE, TILE_SIZE, assets.block));
                    break;
                case 'C':
                    coins.push(new Coin(x, y, TILE_SIZE, TILE_SIZE, assets.coin, 11, 10));
                    break;
                case 'S':
                    playerStartX = x;
                    playerStartY = y;
                    if (assets.start) {
                        startBlockInstance = { x, y, width: TILE_SIZE, height: TILE_SIZE, image: assets.start };
                    }
                    break;
                case 'F':
                    finishZone = { x, y, width: TILE_SIZE, height: TILE_SIZE };
                    if (assets.finish) {
                        finishBlockInstance = { x, y, width: TILE_SIZE, height: TILE_SIZE, image: assets.finish };
                    }
                    break;
            }
        });
    });

    if (player) {
        player.resetState(playerStartX, playerStartY);
    } else {
        player = new Player(playerStartX, playerStartY, assets.jeetix, playJumpSound);
    }
        // Initial camera position update after player is set
    updateCamera();
    return true;
}

async function setupGame() {
    try {
        assets.jeetix = await loadImage('jeetix3.png');
        assets.block = await loadImage('block.png');
        assets.background = await loadImage('background2.png'); // assets.background = await loadImage('background1.png');
        assets.coin = await loadImage('coin-sprite.png'); // png image with all coin frames on a line instead of gif (Useful gif to png-sprite converter: https://ezgif.com/gif-to-sprite )
        assets.start = await loadImage('start.png'); // show start block (set invisible for production)
        assets.finish = await loadImage('finish.png'); // show finish block (set invisible for production)
        // IKKE last jump.mp3 her
    } catch (error) {
        console.error("Error loading assets:", error);
        ctx.fillStyle = 'red';
        ctx.font = '20px Arial';
        ctx.fillText('Error loading assets. Please refresh.', 50, 50);
        return;
    }

    inputHandler = new InputHandler();
    const levelOK = await setupLevel(currentLevelIndex);
    if (!levelOK) return;

    gameLoop(0);
}

function playJumpSound() {
    playSound(jumpSoundBuffer);
}

function resetCurrentLevel() {
    if (gameWon) return;
    console.log("Resetting current level");
    setupLevel(currentLevelIndex).then(success => {
        if (success && player) {
            player.resetState(playerStartX, playerStartY);
            updateCamera(); // Ensure camera resets too
        }
    });
}

function goToNextLevel() {
    if (gameWon) return;
    currentLevelIndex++;
    if (currentLevelIndex >= levelFileNames.length) {
        gameWon = true;
        newHighScore = ScoreManager.flush();
        console.log("Game Won!");
    } else {
        console.log("Going to next level:", currentLevelIndex);
        setupLevel(currentLevelIndex).then(success => {
            if (success && player) {
                player.resetState(playerStartX, playerStartY);
                 updateCamera(); // Ensure camera updates for new level
            }
        });
    }
}

function checkCollisions() {
    if (!player) return;

    coins.forEach((coin, index) => {
        if (!coin.collected &&
            player.x < coin.x + coin.width &&
            player.x + player.width > coin.x &&
            player.y < coin.y + coin.height &&
            player.y + player.height > coin.y) {
            coin.collected = true;
            ScoreManager.add(10);
            if (coinSoundBuffer) playSound(coinSoundBuffer);
        }
    });

    if (finishZone &&
        player.x < finishZone.x + finishZone.width &&
        player.x + player.width > finishZone.x &&
        player.y < finishZone.y + finishZone.height &&
        player.y + player.height > finishZone.y) {
        goToNextLevel();
    }
}

function updateCamera() {
    if (!player) return;

    // Target camera position to center player
    let targetCameraX = player.x - GAME_WIDTH / 2 + player.width / 2;
    let targetCameraY = player.y - GAME_HEIGHT / 2 + player.height / 2;

    // Clamp camera to level boundaries
    // Ensure levelPixelWidth - GAME_WIDTH is not negative (if level is smaller than canvas)
    cameraX = Math.max(0, Math.min(targetCameraX, Math.max(0, levelPixelWidth - GAME_WIDTH)));
    cameraY = Math.max(0, Math.min(targetCameraY, Math.max(0, levelPixelHeight - GAME_HEIGHT)));
}

function update(deltaTime) {
    if (gameWon || !player) return;

    player.update(deltaTime, inputHandler, platforms, GRAVITY, PLAYER_SPEED, JUMP_FORCE, levelPixelWidth, levelPixelHeight);
    coins.forEach(coin => coin.update(deltaTime));
    checkCollisions();
    updateCamera();

    // Player falls off bottom of the *level*
    if (player.y > levelPixelHeight) { 
        resetCurrentLevel();
    }
}

function render() {
    // Clear canvas (will be covered by background)
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Draw Background (loops and scrolls with parallax)
    if (assets.background) {
        const bgImg = assets.background;
        const bgWidth = bgImg.width;
        const bgHeight = bgImg.height;
        const parallaxFactor = 0.5; // Background scrolls at half speed of camera

        let RcameraX = cameraX * parallaxFactor;
        let RcameraY = cameraY * parallaxFactor;

        let startX = -(RcameraX % bgWidth);
        if (startX > 0) startX -= bgWidth; // Ensure correct wrapping for negative camera * parallax

        let startY = -(RcameraY % bgHeight);
        if (startY > 0) startY -= bgHeight; // Ensure correct wrapping

        ctx.save();
        for (let x = startX; x < GAME_WIDTH; x += bgWidth) {
            for (let y = startY; y < GAME_HEIGHT; y += bgHeight) {
                ctx.drawImage(bgImg, x, y, bgWidth, bgHeight);
            }
        }
        ctx.restore();
    } else {
        // Fallback background color
        ctx.fillStyle = '#70c5ce';
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }

    if (gameWon && currentLevelIndex >= levelFileNames.length) {
        ctx.fillStyle = 'gold';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('YOU WIN!', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30);
        ctx.font = '30px Arial';
        ctx.fillText(`Final Score: ${ScoreManager.get()}`, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20);
        if (newHighScore) {
            ctx.fillText(`Highscore Score: ${ScoreManager.getHighScore()} New!`, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 70);
        } else {
            ctx.fillText(`Highscore Score: ${ScoreManager.getHighScore()}`, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 70);
        }
        ctx.textAlign = 'left';
        return;
    }
    
    if (gameWon && currentLevelIndex < levelFileNames.length) { 
        // This case handles the brief moment between loading levels if there's an error
        // Or if we want a "Level Complete" screen later. For now, just don't draw game.
        return;
    }

    // Apply camera transform for game world elements
    ctx.save();
    ctx.translate(-cameraX, -cameraY);

    if (startBlockInstance && startBlockInstance.image) {
        ctx.drawImage(startBlockInstance.image, startBlockInstance.x, startBlockInstance.y, startBlockInstance.width, startBlockInstance.height);
    }
    if (finishBlockInstance && finishBlockInstance.image) {
        ctx.drawImage(finishBlockInstance.image, finishBlockInstance.x, finishBlockInstance.y, finishBlockInstance.width, finishBlockInstance.height);
    }

    platforms.forEach(platform => platform.draw(ctx));
    coins.forEach(coin => coin.draw(ctx));
    
    if (player) {
        player.draw(ctx);
    }

    ctx.restore(); // Remove camera transform

    // Draw UI elements (fixed on screen)
    ctx.fillStyle = 'white';
    ctx.font = '24px Arial';
    ctx.fillText(`Score: ${ScoreManager.get()}`, 20, 30);
    ctx.fillText(`Level: ${currentLevelIndex + 1}`, GAME_WIDTH - 120, 30);
}

function gameLoop(timestamp) {
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    if (!isNaN(deltaTime) && deltaTime > 0) { 
        update(deltaTime / 16);
    }
    render();

    requestAnimationFrame(gameLoop);
}

setupGame();
