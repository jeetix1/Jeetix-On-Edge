import Player from './player.js';
import Platform from './platform.js';
import InputHandler from './input.js';
import Coin from './coin.js';
import ScoreManager from './scores.js';
import LavaBlock from './lava.js';
import JumpPadBlock from './jumppad.js';
import Life from './Life.js';
import Backloss from './backloss.js'
import Latex from './latex.js'

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const GAME_WIDTH = 800; // Viewport width
const GAME_HEIGHT = 600; // Viewport height
canvas.width = GAME_WIDTH;
canvas.height = GAME_HEIGHT;

const GRAVITY = 0.5;
const PLAYER_SPEED = 5;
const JUMP_FORCE = -12;
const JUMP_PAD_BOOST = JUMP_FORCE * 2; // Jump pad boost is double the normal jump force
const TILE_SIZE = 40;

let player;
let platforms = [];
let coins = [];
let lifePickups = [];

let lives = 3;

let lavaBlocks = []; // Array for lava blocks
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
let gameOverMusicBuffer = null;
let gameOverMusicSource = null;
let victoryMusicBuffer = null;
let victoryMusicSource = null;
let stompSoundBuffer;
let enemyHitSoundBuffer;
let backlossBG = null;
let enemies = [];


let showGameOverScreen = false;

let lavaSoundBuffer;
let jumpPadSoundBuffer;


let lastTime = 0;
let currentLevelIndex = 0;
const levelFileNames = [
    './maps/main/level_001.csv',
    './maps/main/level_002.csv',
    './maps/main/level_003.csv',
    './maps/main/level_004.csv'
];
let gameWon = false;
let isHighScore = false;
let score = ScoreManager();
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

function playGameOverMusic() {
  if (!audioContext || !gameOverMusicBuffer) return
  audioContext.resume().then(() => {
    if (bgMusicSource) bgMusicSource.stop()
    if (gameOverMusicSource) gameOverMusicSource.stop()
    gameOverMusicSource = audioContext.createBufferSource()
    gameOverMusicSource.buffer = gameOverMusicBuffer
    gameOverMusicSource.connect(audioContext.destination)
    gameOverMusicSource.start(0)
  })
}


// NEW SOUND PLAYBACK FUNCTIONS FOR LAVA AND JUMPPAD
function playLavaSound() {
    playSound(lavaSoundBuffer);
}


function playStompSound() {
    playSound(stompSoundBuffer)
}

function playEnemyHitSound() {
    playSound(enemyHitSoundBuffer)
}

function playJumpPadSound() {
    playSound(jumpPadSoundBuffer);
}


function initAudioAndLoadSound() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (!soundLoaded) {
        loadSound('./assets/sfx/jump.mp3').then(buf => {
            jumpSoundBuffer = buf;
            soundLoaded = true;
        });
    }
    if (!coinSoundLoaded) {
        loadSound('./assets/sfx/coin_pickup.mp3').then(buf => {
            coinSoundBuffer = buf;
            coinSoundLoaded = true;
        });
    }
    if (!lavaSoundBuffer) {
        loadSound('./assets/sfx/lava_splash.mp3').then(buf => {
            lavaSoundBuffer = buf;
        });
    }
    if (!jumpPadSoundBuffer) {
        loadSound('./assets/sfx/jumppad_boing.mp3').then(buf => {
            jumpPadSoundBuffer = buf;
        });
    }

    if (!bgMusicBuffer) {
        loadBackgroundMusic('./assets/mus/Jeetix_on_edge_theme.mp3').then(buf => {
            bgMusicBuffer = buf;
            playBackgroundMusic();
        });
    }

    if (!gameOverMusicBuffer) {
    loadSound('./assets/mus/Game_Over.mp3').then(buf => {
        gameOverMusicBuffer = buf
    })
    }

    if (!victoryMusicBuffer) {
    loadSound('./assets/mus/victory_screen.mp3').then(buf => {
        victoryMusicBuffer = buf
    })
    }
    if (!stompSoundBuffer) loadSound('./assets/sfx/stomp.mp3').then(buf => stompSoundBuffer = buf)
    if (!enemyHitSoundBuffer) loadSound('./assets/sfx/enemy_hit.mp3').then(buf => enemyHitSoundBuffer = buf)

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
        isHighScore = score.flushToStorage();
        return false;
    }

    enemies = [];
    platforms = [];
    coins = [];
    lifePickups = [] ;
    lavaBlocks = [];
    finishZone = null;
    startBlockInstance = null;
    finishBlockInstance = null;

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
                case 'L':
                    lavaBlocks.push(new LavaBlock(x, y, TILE_SIZE, TILE_SIZE, assets.lava));
                    break;
                case 'J':
                    platforms.push(new JumpPadBlock(x, y, TILE_SIZE, TILE_SIZE, assets.jumppad));
                    break;
                case 'H':
                lifePickups.push(new Life(x, y, assets.life, 22, 10))
                    break;
                case 'E':
                    enemies.push(new Latex(x, y, assets.latex, TILE_SIZE, TILE_SIZE, 2))
                    break;
                            }
                        });
                    });

    if (player) {
        player.resetState(playerStartX, playerStartY);
    } else {
        // PLAYER INITIALIZATION WITH JUMP PAD BOOST AND SOUND
        player = new Player(
            playerStartX,
            playerStartY,
            assets.jeetix,
            playJumpSound,
            JUMP_PAD_BOOST, // Pass boost amount
            playJumpPadSound  // Pass jump pad sound callback
        );
    }
        // Initial camera position update after player is set
    updateCamera();
    return true;
}

async function setupGame() {
    try {
        assets.backloss = await loadImage('./assets/img/backloss.png')
        assets.lifeIcon = await loadImage('./assets/img/life_icon.png');
        assets.jeetix = await loadImage('./assets/img/jeetix.png');
        assets.latex = await loadImage('./assets/img/enemy_latex.png')
        assets.block = await loadImage('./assets/img/block.png');
        assets.background = await loadImage('./assets/img/background2.png'); 
        assets.coin = await loadImage('./assets/img/coin-sprite.png'); 
        assets.start = await loadImage('./assets/img/start.png'); 
        assets.finish = await loadImage('./assets/img/finish.png'); 
        assets.lava = await loadImage('./assets/img/lava.png'); 
        assets.jumppad = await loadImage('./assets/img/jumppad.png'); 
        assets.life = await loadImage('./assets/img/life_pickup.png')
    } catch (error) {
        console.error("Error loading assets:", error);
        ctx.fillStyle = 'red';
        ctx.font = '20px Arial';
        ctx.fillText('Error loading assets. Please refresh.', 50, 50);
        return;
    }

  const img = assets.backloss
  const frameW = img.width / 32
  const frameH = img.height
  backlossBG = new Backloss(img, frameW, frameH, 32, 5)

    inputHandler = new InputHandler();
    canvas.addEventListener('click', event => {
  const inEndState =
    showGameOverScreen ||
    (gameWon && currentLevelIndex >= levelFileNames.length)
  if (!inEndState) return

  const rect = canvas.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  const bx = GAME_WIDTH/2 - 75
  const by = GAME_HEIGHT/2 + (showGameOverScreen ? 30 : 110)
  const bw = 150
  const bh = 40

  if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
    restartGame();
  }
});
    const levelOK = await setupLevel(currentLevelIndex);
    if (!levelOK) return;

    gameLoop(0);
}

function playJumpSound() {
    playSound(jumpSoundBuffer);
}

function playVictoryMusic() {
  if (!audioContext || !victoryMusicBuffer) return
  audioContext.resume().then(() => {
    if (bgMusicSource)      bgMusicSource.stop()
    if (victoryMusicSource) victoryMusicSource.stop()
    victoryMusicSource = audioContext.createBufferSource()
    victoryMusicSource.buffer = victoryMusicBuffer
    victoryMusicSource.connect(audioContext.destination)
    victoryMusicSource.start(0)
  })
}

function resetCurrentLevel() {
  if (gameWon) return

  lives--
if (lives <= 0) {
  gameWon = true
  showGameOverScreen = true
  isHighScore = score.flushToStorage()
  playGameOverMusic()
  return
}


  player.resetState(playerStartX, playerStartY)
  updateCamera()
}



function goToNextLevel() {
    if (gameWon) return;
    currentLevelIndex++;
    if (currentLevelIndex >= levelFileNames.length) {
        gameWon = true;
        isHighScore = score.flushToStorage();
        playVictoryMusic();
    } else {
        console.log("Going to next level:", currentLevelIndex);
        setupLevel(currentLevelIndex).then(success => {
            if (success && player) {
                player.resetState(playerStartX, playerStartY);
                 updateCamera(); 
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
            score.add(10);
            if (coinSoundBuffer) playSound(coinSoundBuffer);
        }
    });


    enemies = enemies.filter(enemy => {
        if (
            player.x < enemy.x + enemy.width &&
            player.x + player.width > enemy.x &&
            player.y < enemy.y + enemy.height &&
            player.y + player.height > enemy.y
        ) {
            if (player.vy > 0 && (player.y + player.height) - enemy.y < enemy.height / 2) {
                playStompSound()
                player.vy = JUMP_FORCE
                return false
            }
            playEnemyHitSound()
            resetCurrentLevel()
        }
        return true
    })



    lifePickups.forEach(lp => {
        if (lp.collected) return
        if (player.x < lp.x + lp.width &&
            player.x + player.width > lp.x &&
            player.y < lp.y + lp.height &&
            player.y + player.height > lp.y) {
            lp.collected = true
            lives++
            if (coinSoundBuffer) playSound(coinSoundBuffer)
        }
    });

    
    lavaBlocks.forEach(lava => {
        if (player.x < lava.x + lava.width &&
            player.x + player.width > lava.x &&
            player.y < lava.y + lava.height &&
            player.y + player.height > lava.y) {
            playLavaSound();
            resetCurrentLevel(); // Player touched lava
            return; // Exit early if reset is called
        }
    });


    // Finish zone collision
    if (finishZone &&
        player.x < finishZone.x + finishZone.width &&
        player.x + player.width > finishZone.x &&
        player.y < finishZone.y + finishZone.height &&
        player.y + player.height > finishZone.y) {
        goToNextLevel();
        finishZone = null;   // Prevent repeats until next level sets it again.
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
    if (showGameOverScreen) {
        backlossBG.update(deltaTime)
        return
    }

    if (gameWon || !player) return;

    player.update(deltaTime, inputHandler, platforms, GRAVITY, PLAYER_SPEED, JUMP_FORCE, levelPixelWidth, levelPixelHeight);
    lifePickups.forEach(lp => lp.update(deltaTime));
    coins.forEach(coin => coin.update(deltaTime));
    enemies.forEach(enemy => enemy.update(deltaTime, platforms, lavaBlocks, levelPixelWidth));
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

        if (showGameOverScreen) {
        backlossBG.draw(ctx) 
        ctx.fillStyle = 'rgba(0,0,0,0.75)'
        ctx.fillRect(0,0,GAME_WIDTH,GAME_HEIGHT)

        ctx.fillStyle = 'red'
        ctx.font = '48px Arial'
        ctx.textAlign = 'center'
        ctx.fillText('That was impressively bad.', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 120);
        ctx.fillText('Try again?', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 70);

        ctx.font = '24px Arial'
        ctx.fillStyle = 'white'
        ctx.fillText(`Final Score: ${score.get()}`, GAME_WIDTH/2, GAME_HEIGHT/2 - 10)

        const bx = GAME_WIDTH/2 - 75
        const by = GAME_HEIGHT/2 + 30
        const bw = 150
        const bh = 40

        ctx.fillStyle = '#ff4444'
        ctx.fillRect(bx, by, bw, bh)
        ctx.strokeStyle = 'white'
        ctx.strokeRect(bx, by, bw, bh)

        ctx.fillStyle = 'white'
        ctx.fillText('RETRY', GAME_WIDTH/2, by + 27)
        return
    }

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
        ctx.fillText(`Final Score: ${score.get()}`, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20);
        if (isHighScore) {
            ctx.fillText(`Highscore Score: ${score.getHighScore()} New!`, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 70);
        } else {
            ctx.fillText(`Highscore Score: ${score.getHighScore()}`, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 70);
        }
    const bx = GAME_WIDTH/2 - 75
    const by = GAME_HEIGHT/2 + 110
    const bw = 150
    const bh = 40

    ctx.fillStyle = '#ff4444'
    ctx.fillRect(bx, by, bw, bh)
    ctx.strokeStyle = 'white'
    ctx.strokeRect(bx, by, bw, bh)
    ctx.fillStyle = 'white'
    ctx.textAlign = 'center'
    ctx.fillText('RETRY', GAME_WIDTH/2, by + 27)

    return
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

    platforms.forEach(platform => platform.draw(ctx)); // JumpPads are drawn here as they are in platforms array
    coins.forEach(coin => coin.draw(ctx));
    enemies.forEach(enemy => enemy.draw(ctx));
    lifePickups.forEach(lp => lp.draw(ctx));
    lavaBlocks.forEach(lava => lava.draw(ctx)); // Draw lava blocks
    
    if (player) {
        player.draw(ctx);
    }

    ctx.restore(); // Remove camera transform

    // Draw UI elements (fixed on screen)
    ctx.fillStyle = 'white';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Score: ${score.get()}`, GAME_WIDTH / 2, 30);
    ctx.textAlign = 'right';
    ctx.fillText(`Level: ${currentLevelIndex + 1}`, GAME_WIDTH - 20, 30);
    ctx.textAlign = 'left';
    if (assets.lifeIcon) {
        const iconSize = 32;
        const iconX = 20;
        const iconY = 10;
        ctx.drawImage(assets.lifeIcon, iconX, iconY, iconSize, iconSize);
        ctx.fillText(`x ${lives}`, iconX + iconSize + 5, iconY + 24);
    }
    ctx.textAlign = 'left';

}

function gameLoop(timestamp) {
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;


    if (!isNaN(deltaTime) && deltaTime > 0) {
        const cappedDeltaTime = Math.min(deltaTime, 50);

        update(deltaTime / 16);
    }
    render();

    requestAnimationFrame(gameLoop);


}
function restartGame() {
    if (gameOverMusicSource) gameOverMusicSource.stop(0)
    if (victoryMusicSource)   victoryMusicSource.stop(0)
    playBackgroundMusic();
    lives = 4;
    score.set(0);
    currentLevelIndex = 0;
    gameWon = false;
    showGameOverScreen = false;
    setupLevel(currentLevelIndex);
}

setupGame();
