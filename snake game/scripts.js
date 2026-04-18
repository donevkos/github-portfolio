// Sound Engine - Web Audio API
const sfx = {
    ctx: null,
    init() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    },
    playEat() {
        if(!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(440, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    },
    playExplosion() {
        if(!this.ctx) return;
        const bufSize = this.ctx.sampleRate * 0.2;
        const buffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
        noise.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start();
        noise.stop(this.ctx.currentTime + 0.2);
    }
};

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

const game = {
    active: false,
    grid: 25,
    score: 0,
    best: localStorage.getItem('ultraSnakeBest') || 0,
    level: 1,
    combo: 0,
    comboTimer: 0,
    shake: 0,
    particles: [],

    init() {
        this.resize();
        document.getElementById('best-display').innerText = this.best.toString().padStart(4, '0');
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('keydown', (e) => this.handleInput(e));
    },

    resize() {
        this.width = canvas.parentElement.offsetWidth;
        this.height = canvas.parentElement.offsetHeight;
        canvas.width = this.width;
        canvas.height = this.height;
        this.tilesX = Math.floor(this.width / this.grid);
        this.tilesY = Math.floor(this.height / this.grid);
    },

    start() {
        sfx.init(); // Активира аудиото след потребителско действие
        document.getElementById('start-screen').classList.add('hidden');
        this.snake = new Snake(this);
        this.food = new Food(this);
        this.score = 0;
        this.level = 1;
        this.combo = 0;
        this.active = true;
        this.loop();
    },

    handleInput(e) {
        const keys = {ArrowUp: {x:0,y:-1}, ArrowDown: {x:0,y:1}, ArrowLeft: {x:-1,y:0}, ArrowRight: {x:1,y:0}};
        if (keys[e.key]) this.snake.setDir(keys[e.key]);
    },

    update() {
        if (this.shake > 0) this.shake *= 0.9;
        
        if (this.comboTimer > 0) {
            this.comboTimer--;
        } else {
            this.combo = 0;
            document.getElementById('combo-meter').style.display = 'none';
        }

        this.snake.update();
        this.particles.forEach((p, i) => {
            p.update();
            if (p.life <= 0) this.particles.splice(i, 1);
        });

        document.getElementById('score-display').innerText = this.score.toString().padStart(4, '0');
        document.getElementById('lvl-display').innerText = `LVL ${this.level.toString().padStart(2, '0')}`;
    },

    draw() {
        ctx.fillStyle = 'rgba(5, 5, 10, 0.25)'; 
        ctx.fillRect(0, 0, this.width, this.height);

        ctx.save();
        if (this.shake > 1) {
            ctx.translate(Math.random()*this.shake - this.shake/2, Math.random()*this.shake - this.shake/2);
        }

        this.food.draw(ctx);
        this.snake.draw(ctx);
        this.particles.forEach(p => p.draw(ctx));
        
        ctx.restore();
    },

    loop() {
        if (!this.active) return;
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    },

    gameOver() {
        this.active = false;
        this.shake = 40;
        sfx.playExplosion();
        if (this.score > this.best) {
            localStorage.setItem('ultraSnakeBest', this.score);
        }
        document.getElementById('game-over').classList.remove('hidden');
        document.getElementById('final-score').innerText = this.score.toString().padStart(4, '0');
    }
};

class Snake {
    constructor(game) {
        this.game = game;
        this.body = [{x: 10, y: 10}, {x: 10, y: 11}, {x: 10, y: 12}];
        this.dir = {x: 0, y: -1};
        this.nextDir = {x: 0, y: -1};
        this.moveCounter = 0;
        this.speed = 7; 
    }

    setDir(d) {
        if (d.x !== -this.dir.x || d.y !== -this.dir.y) this.nextDir = d;
    }

    update() {
        this.moveCounter++;
        if (this.moveCounter >= this.speed) {
            this.moveCounter = 0;
            this.move();
        }
    }

    move() {
        this.dir = this.nextDir;
        const head = {x: this.body[0].x + this.dir.x, y: this.body[0].y + this.dir.y};

        if (head.x < 0 || head.x >= this.game.tilesX || head.y < 0 || head.y >= this.game.tilesY || 
            this.body.some(b => b.x === head.x && b.y === head.y)) {
            return this.game.gameOver();
        }

        this.body.unshift(head);

        if (head.x === this.game.food.x && head.y === this.game.food.y) {
            sfx.playEat();
            this.game.score += 10 * (this.game.combo + 1);
            this.game.combo++;
            this.game.comboTimer = 150;
            this.game.shake = 15;
            this.game.food.spawn();
            
            if (this.game.combo > 1) {
                document.getElementById('combo-meter').style.display = 'block';
                document.getElementById('combo-num').innerText = this.game.combo;
            }

            for(let i=0; i<15; i++) {
                this.game.particles.push(new Particle(head.x * this.game.grid + 12, head.y * this.game.grid + 12, '#ff007f'));
            }

            if (this.game.score % 100 === 0) {
                this.game.level++;
                this.speed = Math.max(2, this.speed - 0.5);
            }
        } else {
            this.body.pop();
        }
    }

    draw(ctx) {
        this.body.forEach((b, i) => {
            ctx.shadowBlur = i === 0 ? 30 : 0;
            ctx.shadowColor = '#00f2ff';
            ctx.fillStyle = i === 0 ? '#fff' : `rgba(0, 242, 255, ${1 - i/this.body.length})`;
            ctx.beginPath();
            ctx.roundRect(b.x * this.game.grid + 2, b.y * this.game.grid + 2, this.game.grid - 4, this.game.grid - 4, 8);
            ctx.fill();
        });
    }
}

class Food {
    constructor(game) { this.game = game; this.spawn(); }
    spawn() {
        this.x = Math.floor(Math.random() * this.game.tilesX);
        this.y = Math.floor(Math.random() * this.game.tilesY);
    }
    draw(ctx) {
        const pulse = Math.sin(Date.now() / 150) * 5;
        ctx.shadowBlur = 20; ctx.shadowColor = '#ff007f';
        ctx.fillStyle = '#ff007f';
        ctx.beginPath();
        ctx.arc(this.x * this.game.grid + this.game.grid/2, this.y * this.game.grid + this.game.grid/2, 8 + pulse, 0, Math.PI*2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y;
        this.vx = (Math.random() - 0.5) * 10;
        this.vy = (Math.random() - 0.5) * 10;
        this.life = 1.0;
        this.color = color;
    }
    update() { this.x += this.vx; this.y += this.vy; this.life -= 0.04; }
    draw(ctx) {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, 4, 4);
        ctx.globalAlpha = 1;
    }
}

game.init();