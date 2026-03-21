export class Game extends Phaser.Scene {
    constructor() { super('Game'); }

    // ═══════════ DIFFICULTY CURVE ═══════════
    // Linear interpolation over 15 levels.

    getLevelConfig(level) {
        const t = (Math.min(level, 15) - 1) / 14;  // 0..1
        return {
            enemySpeed:    3   + t * 6.5,    // 3.0  → 9.5
            spawnDelay:    1600 - t * 1100,   // 1600 → 500 ms
            missileSpeed:  8   + t * 5,       // 8.0  → 13
            playerSpeed:   5   + t * 1.5,     // 5.0  → 6.5
            levelTime:     45,
        };
    }

    // ═══════════ BACKGROUND PALETTES ═══════════
    // 6 palettes cycling: dawn → morning → day → afternoon → dusk → night

    getBackgroundPalette(level) {
        const palettes = [
            { // 0 - DAWN (levels 1, 7, 13)
                skyTop: 0x1a0a2e, skyMid: 0x6a3060, skyBot: 0xdd7744, horizon: 0xffaa55,
                sunColor: 0xffcc66, sunAlpha: 0.12, sunGlow: 0.06,
                hillFar: 0x3a2a4a, hillNear: 0x2a1a3a, cloudAlpha: 0.25
            },
            { // 1 - MORNING (levels 2, 8, 14)
                skyTop: 0x1a3a6a, skyMid: 0x4a88bb, skyBot: 0x88ccee, horizon: 0xaaddee,
                sunColor: 0xfff0a0, sunAlpha: 0.08, sunGlow: 0.04,
                hillFar: 0x2a6a5a, hillNear: 0x1a5a4a, cloudAlpha: 0.35
            },
            { // 2 - DAY (levels 3, 9, 15)
                skyTop: 0x0c1e3a, skyMid: 0x3a7ab5, skyBot: 0x7ec8e3, horizon: 0xb5e0ea,
                sunColor: 0xffe8a0, sunAlpha: 0.06, sunGlow: 0.04,
                hillFar: 0x2a5a4a, hillNear: 0x1a4a3a, cloudAlpha: 0.35
            },
            { // 3 - AFTERNOON (levels 4, 10)
                skyTop: 0x1a3055, skyMid: 0x5588aa, skyBot: 0xaacc88, horizon: 0xccddaa,
                sunColor: 0xffdd88, sunAlpha: 0.10, sunGlow: 0.06,
                hillFar: 0x3a6644, hillNear: 0x2a5533, cloudAlpha: 0.30
            },
            { // 4 - DUSK (levels 5, 11)
                skyTop: 0x0a0a22, skyMid: 0x442255, skyBot: 0xcc5533, horizon: 0xff7744,
                sunColor: 0xff8844, sunAlpha: 0.15, sunGlow: 0.08,
                hillFar: 0x2a1a2a, hillNear: 0x1a0a1a, cloudAlpha: 0.20
            },
            { // 5 - NIGHT (levels 6, 12)
                skyTop: 0x020010, skyMid: 0x0a1a3a, skyBot: 0x15304a, horizon: 0x1a3855,
                sunColor: 0xccddff, sunAlpha: 0.03, sunGlow: 0.02,
                hillFar: 0x0a1a2a, hillNear: 0x05101a, cloudAlpha: 0.15
            },
        ];
        return palettes[(level - 1) % 6];
    }

    create(data) {
        this.level = data.level || 1;
        this.maxLevel = 15;

        // ── Level-scaled parameters ──
        this.cfg = this.getLevelConfig(this.level);
        this.timeLeft = 45;

        this.lives = 3;
        this.score = 0;
        this.totalScore = data.totalScore || 0;
        this.kills = 0;
        this.isPaused = false;

        // Background (level-based palette)
        this.drawStaticBackground();

        // Audio
        this.audio = this.registry.get('audioEngine');

        // Particles
        this.explosions = [];
        this.collisionFx = [];
        this.fxGfx = this.add.graphics().setDepth(15);

        // Clouds
        this.farCloudGfx = this.add.graphics().setDepth(1);
        this.nearCloudGfx = this.add.graphics().setDepth(2);
        this.farClouds = []; this.nearClouds = [];
        for (let i = 0; i < 4; i++) this.farClouds.push({x:Phaser.Math.Between(0,1400),y:Phaser.Math.Between(60,350),scale:Phaser.Math.FloatBetween(0.5,0.8)});
        for (let i = 0; i < 3; i++) this.nearClouds.push({x:Phaser.Math.Between(0,1400),y:Phaser.Math.Between(100,600),scale:Phaser.Math.FloatBetween(0.9,1.4)});

        // HUD
        this.hudTotalText = null;
        this.createHUD();

        // Timer
        this.time.addEvent({delay:1000,loop:true,callback:()=>{
            if(this.isPaused||this.cheatActive)return;
            this.timeLeft--;
            // Shield countdown
            if(this.shieldTimer > 0) {
                this.shieldTimer--;
                if(this.shieldTimer <= 0) this.shieldActive = false;
            }
            if(this.timeLeft<=0)this.endLevel();
        }});

        // Input
        this.cursors = this.input.keyboard.createCursorKeys();
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        this.ctrlKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.CTRL);
        this.xKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);

        // Cheat
        this.cheatActive = false; this.cheatText = ''; this.cheatBox = null; this.cheatDisplay = null;
        this.input.keyboard.on('keydown',(event)=>{
            if(!this.cheatActive)return;
            if(event.key==='Backspace'){this.cheatText=this.cheatText.slice(0,-1);}
            else if(event.key==='Enter'){const l=parseInt(this.cheatText);if(l>=1&&l<=this.maxLevel)this.scene.restart({level:l,totalScore:this.totalScore});this.closeCheat();}
            else if(this.cheatText.length<30&&event.key.match(/[0-9]/)){this.cheatText+=event.key;}
        });

        // Player
        this.player = {x:150,y:360,gfx:this.add.graphics().setDepth(10),hit:false,hitTimer:0};
        this.bullets = [];
        this.enemies = [];

        // ── Shield state ──
        this.shieldActive = false;
        this.shieldTimer = 0;
        this.shieldGfx = this.add.graphics().setDepth(11);

        // ── Power-ups ──
        this.powerups = [];
        this.powerupCounts = { star: 0, heart: 0 };
        this.powerupTotal = 0;
        this.powerupGfx = this.add.graphics().setDepth(9);
        this.schedulePowerups();

        // ── Touch controls ──
        this.touchGfx = this.add.graphics().setDepth(25);
        this.joystick = { active: false, baseX: 120, baseY: 520, radius: 60, knobRadius: 24, knobY: 520, pointerId: null };
        this.fireBtn = { active: false, x: 1160, y: 520, radius: 50, pointerId: null };
        this.touchFireCooldown = 0;

        // Pause button for touch (top-right)
        this.pauseBtn = { x: 1240, y: 30, radius: 22 };

        this.input.addPointer(2); // support up to 3 simultaneous touches

        this.input.on('pointerdown', (pointer) => {
            if (this.isPaused || this.cheatActive) return;
            const dx = pointer.x, dy = pointer.y;

            // Pause button
            if (Phaser.Math.Distance.Between(dx, dy, this.pauseBtn.x, this.pauseBtn.y) < this.pauseBtn.radius + 10) {
                this.showPauseMenu();
                return;
            }

            // Joystick zone (left third of screen)
            if (dx < 400 && !this.joystick.active) {
                this.joystick.active = true;
                this.joystick.pointerId = pointer.id;
                this.joystick.knobY = Phaser.Math.Clamp(dy, this.joystick.baseY - this.joystick.radius, this.joystick.baseY + this.joystick.radius);
            }

            // Fire button zone (right area)
            if (dx > 900 && Phaser.Math.Distance.Between(dx, dy, this.fireBtn.x, this.fireBtn.y) < this.fireBtn.radius + 20) {
                this.fireBtn.active = true;
                this.fireBtn.pointerId = pointer.id;
            }
        });

        this.input.on('pointermove', (pointer) => {
            if (this.joystick.active && pointer.id === this.joystick.pointerId) {
                this.joystick.knobY = Phaser.Math.Clamp(pointer.y, this.joystick.baseY - this.joystick.radius, this.joystick.baseY + this.joystick.radius);
            }
        });

        this.input.on('pointerup', (pointer) => {
            if (this.joystick.active && pointer.id === this.joystick.pointerId) {
                this.joystick.active = false;
                this.joystick.pointerId = null;
                this.joystick.knobY = this.joystick.baseY;
            }
            if (this.fireBtn.active && pointer.id === this.fireBtn.pointerId) {
                this.fireBtn.active = false;
                this.fireBtn.pointerId = null;
            }
        });

        // Spawner (level-scaled delay)
        this.time.addEvent({delay:Math.round(this.cfg.spawnDelay),loop:true,callback:()=>{
            if(this.isPaused||this.cheatActive)return;
            this.enemies.push({x:1300,y:Phaser.Math.Between(50,650),gfx:this.add.graphics().setDepth(8)});
        }});
    }

    // ═══════════ POWER-UP SCHEDULING ═══════════
    // 1-3 of each type, 4 max total per level
    // Random timing spread across the 45s level duration

    schedulePowerups() {
        const levelDur = this.cfg.levelTime * 1000; // ms
        const margin = 3000; // don't spawn in first/last 3s

        // Decide counts: 1-3 each, 4 max total
        let starCount = Phaser.Math.Between(1, 3);
        let heartCount = Phaser.Math.Between(1, 3);
        while (starCount + heartCount > 4) {
            if (Math.random() < 0.5 && starCount > 1) starCount--;
            else if (heartCount > 1) heartCount--;
            else starCount--;
        }

        const allSpawns = [];
        for (let i = 0; i < starCount; i++) allSpawns.push('star');
        for (let i = 0; i < heartCount; i++) allSpawns.push('heart');

        // Shuffle
        for (let i = allSpawns.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allSpawns[i], allSpawns[j]] = [allSpawns[j], allSpawns[i]];
        }

        // Spread evenly with jitter
        const count = allSpawns.length;
        const timeWindow = levelDur - margin * 2;
        allSpawns.forEach((type, idx) => {
            const baseTime = margin + (timeWindow / (count + 1)) * (idx + 1);
            const jitter = (Math.random() - 0.5) * (timeWindow / (count + 1)) * 0.6;
            const delay = Math.max(margin, Math.min(levelDur - margin, baseTime + jitter));

            this.time.addEvent({
                delay: Math.round(delay),
                callback: () => {
                    if (this.isPaused || this.cheatActive) return;
                    if (this.powerupCounts[type] >= 3 || this.powerupTotal >= 4) return;
                    this.powerupCounts[type]++;
                    this.powerupTotal++;
                    const speed = this.cfg.enemySpeed * 1.3;
                    this.powerups.push({
                        type: type,
                        x: 1350,
                        y: Phaser.Math.Between(80, 620),
                        speed: speed
                    });
                }
            });
        });
    }

    // ═══════════ EXPLOSIONS & FX ═══════════

    spawnExplosion(x, y) {
        const particles = [];
        for (let i = 0; i < 18; i++) {
            const ang = Math.random() * Math.PI * 2;
            const spd = 1 + Math.random() * 4;
            const life = 20 + Math.random() * 25;
            const colors = [0xff4400, 0xff8800, 0xffcc00, 0xffee88, 0xff6600];
            particles.push({
                x: x, y: y,
                vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
                life: life, maxLife: life,
                r: 2 + Math.random() * 4,
                color: colors[Math.floor(Math.random() * colors.length)]
            });
        }
        for (let i = 0; i < 8; i++) {
            const ang = Math.random() * Math.PI * 2;
            const spd = 0.5 + Math.random() * 3;
            const life = 30 + Math.random() * 20;
            particles.push({
                x: x, y: y,
                vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd + 0.5,
                life: life, maxLife: life,
                r: 1 + Math.random() * 2,
                color: [0x555555, 0x888888, 0x993333][Math.floor(Math.random() * 3)]
            });
        }
        this.explosions.push({ particles });
    }

    spawnCollisionFx(x, y) {
        const particles = [];
        for (let i = 0; i < 12; i++) {
            const ang = Math.random() * Math.PI * 2;
            const spd = 1 + Math.random() * 3;
            const life = 12 + Math.random() * 15;
            particles.push({
                x: x, y: y,
                vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
                life: life, maxLife: life,
                r: 1.5 + Math.random() * 3,
                color: [0xffffff, 0xffff00, 0xff8800, 0x44aaff][Math.floor(Math.random() * 4)]
            });
        }
        this.collisionFx.push({ x, y, life: 20, maxLife: 20, particles });
    }

    spawnPickupFx(x, y, type) {
        const particles = [];
        const colors = type === 'star'
            ? [0x44ddff, 0x88eeff, 0xaaffff, 0xffffff]
            : [0xff4466, 0xff88aa, 0xffaacc, 0xffffff];
        for (let i = 0; i < 14; i++) {
            const ang = Math.random() * Math.PI * 2;
            const spd = 1.5 + Math.random() * 3;
            const life = 15 + Math.random() * 15;
            particles.push({
                x: x, y: y,
                vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
                life: life, maxLife: life,
                r: 1.5 + Math.random() * 3,
                color: colors[Math.floor(Math.random() * colors.length)]
            });
        }
        this.collisionFx.push({ x, y, life: 18, maxLife: 18, particles });
    }

    updateFx() {
        this.fxGfx.clear();

        for (let ei = this.explosions.length - 1; ei >= 0; ei--) {
            const ex = this.explosions[ei];
            let allDead = true;
            ex.particles.forEach(p => {
                if (p.life <= 0) return;
                allDead = false;
                p.x += p.vx; p.y += p.vy;
                p.vx *= 0.96; p.vy *= 0.96;
                p.life--;
                const alpha = p.life / p.maxLife;
                this.fxGfx.fillStyle(p.color, alpha);
                this.fxGfx.fillCircle(p.x, p.y, p.r * alpha);
            });
            if (allDead) this.explosions.splice(ei, 1);
        }

        for (let ci = this.collisionFx.length - 1; ci >= 0; ci--) {
            const cf = this.collisionFx[ci];
            let allDead = true;
            cf.particles.forEach(p => {
                if (p.life <= 0) return;
                allDead = false;
                p.x += p.vx; p.y += p.vy;
                p.life--;
                const alpha = p.life / p.maxLife;
                this.fxGfx.fillStyle(p.color, alpha * 0.8);
                this.fxGfx.fillCircle(p.x, p.y, p.r * alpha);
            });
            if (cf.life > 10) {
                const a = (cf.life - 10) / 10;
                this.fxGfx.fillStyle(0xffffff, a * 0.5);
                this.fxGfx.fillCircle(cf.x, cf.y, 20 * a);
            }
            cf.life--;
            if (allDead && cf.life <= 0) this.collisionFx.splice(ci, 1);
        }
    }

    // ═══════════ BACKGROUND ═══════════

    drawStaticBackground() {
        const p = this.getBackgroundPalette(this.level);
        const bg = this.add.graphics().setDepth(0);

        bg.fillGradientStyle(p.skyTop,p.skyTop,p.skyMid,p.skyMid); bg.fillRect(0,0,1280,400);
        bg.fillGradientStyle(p.skyMid,p.skyMid,p.skyBot,p.skyBot); bg.fillRect(0,400,1280,200);
        bg.fillGradientStyle(p.skyBot,p.skyBot,p.horizon,p.horizon); bg.fillRect(0,600,1280,120);

        bg.fillStyle(p.sunColor, p.sunAlpha); bg.fillCircle(1150,680,200);
        bg.fillStyle(p.sunColor, p.sunGlow); bg.fillCircle(1150,680,320);

        bg.fillStyle(p.hillFar, 0.15);
        bg.beginPath(); bg.moveTo(0,700); bg.lineTo(0,660); bg.lineTo(80,640); bg.lineTo(200,665); bg.lineTo(320,630); bg.lineTo(480,655); bg.lineTo(580,620); bg.lineTo(700,650); bg.lineTo(820,615); bg.lineTo(950,645); bg.lineTo(1050,625); bg.lineTo(1180,650); bg.lineTo(1280,635); bg.lineTo(1280,700); bg.closePath(); bg.fillPath();
        bg.fillStyle(p.hillNear, 0.12);
        bg.beginPath(); bg.moveTo(0,720); bg.lineTo(0,680); bg.lineTo(150,670); bg.lineTo(300,690); bg.lineTo(450,665); bg.lineTo(600,685); bg.lineTo(750,670); bg.lineTo(900,690); bg.lineTo(1050,675); bg.lineTo(1200,685); bg.lineTo(1280,678); bg.lineTo(1280,720); bg.closePath(); bg.fillPath();

        this.cloudAlpha = p.cloudAlpha;
    }

    drawCloud(gfx,x,y,s){
        const a = this.cloudAlpha || 0.35;
        gfx.fillStyle(0xffffff,a*s);gfx.fillCircle(x,y,28*s);gfx.fillCircle(x+25*s,y-10*s,35*s);gfx.fillCircle(x+55*s,y-5*s,30*s);gfx.fillCircle(x+80*s,y,25*s);gfx.fillCircle(x+35*s,y+8*s,22*s);
        gfx.fillStyle(0xffffff,(a*0.43)*s);gfx.fillCircle(x+25*s,y-18*s,20*s);gfx.fillCircle(x+55*s,y-15*s,18*s);
    }

    // ═══════════ PLAYER PLANE ═══════════

    drawPlayerPlane(gfx, x, y) {
        const fl1=16+Math.random()*14,fl2=12+Math.random()*10,flY=(Math.random()-0.5)*2;
        gfx.fillStyle(0xff4400,0.3);gfx.beginPath();gfx.moveTo(x-44,y+3);gfx.lineTo(x-44,y+8);gfx.lineTo(x-44-fl1,y+5.5+flY);gfx.closePath();gfx.fillPath();
        gfx.fillStyle(0xffaa00,0.5);gfx.beginPath();gfx.moveTo(x-44,y+4);gfx.lineTo(x-44,y+7);gfx.lineTo(x-44-fl2,y+5.5);gfx.closePath();gfx.fillPath();
        gfx.fillStyle(0xff4400,0.3);gfx.beginPath();gfx.moveTo(x-44,y+10);gfx.lineTo(x-44,y+15);gfx.lineTo(x-44-fl1*0.9,y+12.5-flY);gfx.closePath();gfx.fillPath();
        gfx.fillStyle(0xffaa00,0.5);gfx.beginPath();gfx.moveTo(x-44,y+11);gfx.lineTo(x-44,y+14);gfx.lineTo(x-44-fl2*0.9,y+12.5);gfx.closePath();gfx.fillPath();
        gfx.fillStyle(0xffdd66,0.6);gfx.beginPath();gfx.moveTo(x-44,y+4.5);gfx.lineTo(x-44,y+6.5);gfx.lineTo(x-44-fl2*0.3,y+5.5);gfx.closePath();gfx.fillPath();
        gfx.beginPath();gfx.moveTo(x-44,y+11.5);gfx.lineTo(x-44,y+13.5);gfx.lineTo(x-44-fl2*0.3,y+12.5);gfx.closePath();gfx.fillPath();
        gfx.fillStyle(0x3a5a80);gfx.beginPath();gfx.moveTo(x-30,y-2);gfx.lineTo(x-36,y-34);gfx.lineTo(x-46,y-30);gfx.lineTo(x-44,y-2);gfx.closePath();gfx.fillPath();
        gfx.fillStyle(0x5577aa,0.3);gfx.beginPath();gfx.moveTo(x-30,y-2);gfx.lineTo(x-36,y-34);gfx.lineTo(x-40,y-32);gfx.lineTo(x-35,y-2);gfx.closePath();gfx.fillPath();
        gfx.fillStyle(0xccddee,0.3);gfx.beginPath();gfx.moveTo(x-36,y-34);gfx.lineTo(x-38,y-33);gfx.lineTo(x-46,y-30);gfx.closePath();gfx.fillPath();
        gfx.fillStyle(0x4a6a8a);gfx.beginPath();gfx.moveTo(x-28,y-1);gfx.lineTo(x-36,y-8);gfx.lineTo(x-46,y-7);gfx.lineTo(x-42,y);gfx.closePath();gfx.fillPath();
        gfx.fillStyle(0x3a5a80,0.6);gfx.beginPath();gfx.moveTo(x-34,y+16);gfx.lineTo(x-40,y+24);gfx.lineTo(x-44,y+22);gfx.lineTo(x-42,y+16);gfx.closePath();gfx.fillPath();
        gfx.fillStyle(0x4a7099);gfx.beginPath();gfx.moveTo(x+10,y-3);gfx.lineTo(x+2,y-12);gfx.lineTo(x-26,y-14);gfx.lineTo(x-22,y-3);gfx.closePath();gfx.fillPath();
        gfx.fillStyle(0x6a99bb,0.45);gfx.beginPath();gfx.moveTo(x+10,y-3);gfx.lineTo(x+2,y-12);gfx.lineTo(x-8,y-13);gfx.lineTo(x-2,y-3);gfx.closePath();gfx.fillPath();
        gfx.fillStyle(0x3a5a78,0.5);gfx.fillRect(x-6,y-3,2,6);
        gfx.fillStyle(0x5588aa);gfx.beginPath();gfx.moveTo(x+28,y-6);gfx.lineTo(x+22,y-14);gfx.lineTo(x+14,y-13);gfx.lineTo(x+18,y-6);gfx.closePath();gfx.fillPath();
        gfx.fillStyle(0x5a8aaa);gfx.beginPath();gfx.moveTo(x+52,y+5);gfx.lineTo(x+44,y-2);gfx.lineTo(x+30,y-6);gfx.lineTo(x+6,y-5);gfx.lineTo(x-20,y-3);gfx.lineTo(x-44,y);gfx.lineTo(x-44,y+16);gfx.lineTo(x-20,y+18);gfx.lineTo(x+6,y+16);gfx.lineTo(x+30,y+12);gfx.lineTo(x+44,y+10);gfx.closePath();gfx.fillPath();
        gfx.fillStyle(0x7aabb8,0.35);gfx.beginPath();gfx.moveTo(x+52,y+5);gfx.lineTo(x+44,y-2);gfx.lineTo(x+30,y-6);gfx.lineTo(x+6,y-5);gfx.lineTo(x-20,y-3);gfx.lineTo(x-44,y);gfx.lineTo(x-44,y+6);gfx.lineTo(x-20,y+6);gfx.lineTo(x+6,y+4);gfx.lineTo(x+30,y+3);gfx.lineTo(x+44,y+3);gfx.closePath();gfx.fillPath();
        gfx.fillStyle(0x3a6a88,0.25);gfx.beginPath();gfx.moveTo(x+44,y+8);gfx.lineTo(x+30,y+12);gfx.lineTo(x+6,y+16);gfx.lineTo(x-20,y+18);gfx.lineTo(x-44,y+16);gfx.lineTo(x-44,y+12);gfx.lineTo(x-20,y+13);gfx.lineTo(x+6,y+11);gfx.lineTo(x+30,y+9);gfx.closePath();gfx.fillPath();
        gfx.fillStyle(0x2a4a66);gfx.beginPath();gfx.moveTo(x+24,y+10);gfx.lineTo(x+8,y+13);gfx.lineTo(x+8,y+18);gfx.lineTo(x+24,y+14);gfx.closePath();gfx.fillPath();
        gfx.fillStyle(0x7799aa,0.4);gfx.beginPath();gfx.moveTo(x+24,y+10);gfx.lineTo(x+8,y+13);gfx.lineTo(x+8,y+14);gfx.lineTo(x+24,y+11);gfx.closePath();gfx.fillPath();
        gfx.fillStyle(0x2a4a66);gfx.fillCircle(x-44,y+5.5,3.5);gfx.fillCircle(x-44,y+12.5,3.5);
        gfx.fillStyle(0x1a3a55);gfx.fillCircle(x-44,y+5.5,2);gfx.fillCircle(x-44,y+12.5,2);
        gfx.lineStyle(0.5,0x7799aa,0.3);gfx.strokeCircle(x-44,y+5.5,3.5);gfx.strokeCircle(x-44,y+12.5,3.5);
        gfx.fillStyle(0x33ccff,0.7);gfx.beginPath();gfx.moveTo(x+36,y-4);gfx.lineTo(x+30,y-16);gfx.lineTo(x+12,y-17);gfx.lineTo(x+6,y-6);gfx.closePath();gfx.fillPath();
        gfx.lineStyle(1.5,0x4a7099,0.5);gfx.beginPath();gfx.moveTo(x+21,y-17);gfx.lineTo(x+20,y-5);gfx.strokePath();
        gfx.lineStyle(1,0x4a7099,0.4);gfx.beginPath();gfx.moveTo(x+36,y-4);gfx.lineTo(x+30,y-16);gfx.strokePath();
        gfx.fillStyle(0xaaeeff,0.4);gfx.beginPath();gfx.moveTo(x+34,y-6);gfx.lineTo(x+30,y-15);gfx.lineTo(x+22,y-16);gfx.lineTo(x+22,y-6);gfx.closePath();gfx.fillPath();
        gfx.fillStyle(0x88aacc,0.6);gfx.beginPath();gfx.moveTo(x+52,y+5);gfx.lineTo(x+46,y+1);gfx.lineTo(x+46,y+9);gfx.closePath();gfx.fillPath();
        gfx.lineStyle(1,0xaabbcc,0.5);gfx.beginPath();gfx.moveTo(x+52,y+5);gfx.lineTo(x+56,y+5);gfx.strokePath();
        gfx.lineStyle(0.5,0x3a6688,0.2);gfx.beginPath();gfx.moveTo(x+42,y+3);gfx.lineTo(x-42,y+6);gfx.strokePath();
        gfx.lineStyle(0.5,0x3a6688,0.15);gfx.beginPath();gfx.moveTo(x+6,y-5);gfx.lineTo(x+6,y+16);gfx.strokePath();
        gfx.lineStyle(1.5,0x88bbdd,0.25);gfx.strokeCircle(x-8,y+6,5);gfx.fillStyle(0x88bbdd,0.1);gfx.fillCircle(x-8,y+6,3);
    }

    // ═══════════ ENEMY PLANE ═══════════

    drawEnemyPlane(gfx, x, y) {
        const fl1=14+Math.random()*12,fl2=10+Math.random()*9,flY=(Math.random()-0.5)*2;
        gfx.fillStyle(0xff3300,0.25);gfx.beginPath();gfx.moveTo(x+44,y+3);gfx.lineTo(x+44,y+8);gfx.lineTo(x+44+fl1,y+5.5+flY);gfx.closePath();gfx.fillPath();
        gfx.fillStyle(0xff7700,0.45);gfx.beginPath();gfx.moveTo(x+44,y+4);gfx.lineTo(x+44,y+7);gfx.lineTo(x+44+fl2,y+5.5);gfx.closePath();gfx.fillPath();
        gfx.fillStyle(0xff3300,0.25);gfx.beginPath();gfx.moveTo(x+44,y+10);gfx.lineTo(x+44,y+15);gfx.lineTo(x+44+fl1*0.9,y+12.5-flY);gfx.closePath();gfx.fillPath();
        gfx.fillStyle(0xff7700,0.45);gfx.beginPath();gfx.moveTo(x+44,y+11);gfx.lineTo(x+44,y+14);gfx.lineTo(x+44+fl2*0.9,y+12.5);gfx.closePath();gfx.fillPath();
        gfx.fillStyle(0xffdd66,0.5);gfx.beginPath();gfx.moveTo(x+44,y+4.5);gfx.lineTo(x+44,y+6.5);gfx.lineTo(x+44+fl2*0.3,y+5.5);gfx.closePath();gfx.fillPath();
        gfx.beginPath();gfx.moveTo(x+44,y+11.5);gfx.lineTo(x+44,y+13.5);gfx.lineTo(x+44+fl2*0.3,y+12.5);gfx.closePath();gfx.fillPath();
        gfx.fillStyle(0x6a2222);gfx.beginPath();gfx.moveTo(x+30,y-2);gfx.lineTo(x+36,y-34);gfx.lineTo(x+46,y-30);gfx.lineTo(x+44,y-2);gfx.closePath();gfx.fillPath();
        gfx.fillStyle(0x993333,0.3);gfx.beginPath();gfx.moveTo(x+30,y-2);gfx.lineTo(x+36,y-34);gfx.lineTo(x+40,y-32);gfx.lineTo(x+35,y-2);gfx.closePath();gfx.fillPath();
        gfx.fillStyle(0xddaaaa,0.25);gfx.beginPath();gfx.moveTo(x+36,y-34);gfx.lineTo(x+38,y-33);gfx.lineTo(x+46,y-30);gfx.closePath();gfx.fillPath();
        gfx.fillStyle(0x772020);gfx.beginPath();gfx.moveTo(x+28,y-1);gfx.lineTo(x+36,y-8);gfx.lineTo(x+46,y-7);gfx.lineTo(x+42,y);gfx.closePath();gfx.fillPath();
        gfx.fillStyle(0x6a2222,0.5);gfx.beginPath();gfx.moveTo(x+34,y+16);gfx.lineTo(x+40,y+24);gfx.lineTo(x+44,y+22);gfx.lineTo(x+42,y+16);gfx.closePath();gfx.fillPath();
        gfx.fillStyle(0x992222);gfx.beginPath();gfx.moveTo(x-10,y-3);gfx.lineTo(x-2,y-12);gfx.lineTo(x+26,y-14);gfx.lineTo(x+22,y-3);gfx.closePath();gfx.fillPath();
        gfx.fillStyle(0xbb4444,0.4);gfx.beginPath();gfx.moveTo(x-10,y-3);gfx.lineTo(x-2,y-12);gfx.lineTo(x+8,y-13);gfx.lineTo(x+2,y-3);gfx.closePath();gfx.fillPath();
        gfx.fillStyle(0x662020,0.5);gfx.fillRect(x+6,y-3,2,6);
        gfx.fillStyle(0xaa3333);gfx.beginPath();gfx.moveTo(x-28,y-6);gfx.lineTo(x-22,y-14);gfx.lineTo(x-14,y-13);gfx.lineTo(x-18,y-6);gfx.closePath();gfx.fillPath();
        gfx.fillStyle(0x882020);gfx.beginPath();gfx.moveTo(x-52,y+5);gfx.lineTo(x-44,y-2);gfx.lineTo(x-30,y-6);gfx.lineTo(x-6,y-5);gfx.lineTo(x+20,y-3);gfx.lineTo(x+44,y);gfx.lineTo(x+44,y+16);gfx.lineTo(x+20,y+18);gfx.lineTo(x-6,y+16);gfx.lineTo(x-30,y+12);gfx.lineTo(x-44,y+10);gfx.closePath();gfx.fillPath();
        gfx.fillStyle(0xaa3333,0.3);gfx.beginPath();gfx.moveTo(x-52,y+5);gfx.lineTo(x-44,y-2);gfx.lineTo(x-30,y-6);gfx.lineTo(x-6,y-5);gfx.lineTo(x+20,y-3);gfx.lineTo(x+44,y);gfx.lineTo(x+44,y+6);gfx.lineTo(x+20,y+6);gfx.lineTo(x-6,y+4);gfx.lineTo(x-30,y+3);gfx.lineTo(x-44,y+3);gfx.closePath();gfx.fillPath();
        gfx.fillStyle(0x551515,0.2);gfx.beginPath();gfx.moveTo(x-44,y+8);gfx.lineTo(x-30,y+12);gfx.lineTo(x-6,y+16);gfx.lineTo(x+20,y+18);gfx.lineTo(x+44,y+16);gfx.lineTo(x+44,y+12);gfx.lineTo(x+20,y+13);gfx.lineTo(x-6,y+11);gfx.lineTo(x-30,y+9);gfx.closePath();gfx.fillPath();
        gfx.fillStyle(0x551515);gfx.beginPath();gfx.moveTo(x-24,y+10);gfx.lineTo(x-8,y+13);gfx.lineTo(x-8,y+18);gfx.lineTo(x-24,y+14);gfx.closePath();gfx.fillPath();
        gfx.fillStyle(0x993333,0.35);gfx.beginPath();gfx.moveTo(x-24,y+10);gfx.lineTo(x-8,y+13);gfx.lineTo(x-8,y+14);gfx.lineTo(x-24,y+11);gfx.closePath();gfx.fillPath();
        gfx.fillStyle(0x551515);gfx.fillCircle(x+44,y+5.5,3.5);gfx.fillCircle(x+44,y+12.5,3.5);
        gfx.fillStyle(0x3a0a0a);gfx.fillCircle(x+44,y+5.5,2);gfx.fillCircle(x+44,y+12.5,2);
        gfx.lineStyle(0.5,0x993333,0.25);gfx.strokeCircle(x+44,y+5.5,3.5);gfx.strokeCircle(x+44,y+12.5,3.5);
        gfx.fillStyle(0xffcc00,0.65);gfx.beginPath();gfx.moveTo(x-36,y-4);gfx.lineTo(x-30,y-16);gfx.lineTo(x-12,y-17);gfx.lineTo(x-6,y-6);gfx.closePath();gfx.fillPath();
        gfx.lineStyle(1.5,0x882020,0.4);gfx.beginPath();gfx.moveTo(x-21,y-17);gfx.lineTo(x-20,y-5);gfx.strokePath();
        gfx.lineStyle(1,0x882020,0.35);gfx.beginPath();gfx.moveTo(x-36,y-4);gfx.lineTo(x-30,y-16);gfx.strokePath();
        gfx.fillStyle(0xffee88,0.35);gfx.beginPath();gfx.moveTo(x-34,y-6);gfx.lineTo(x-30,y-15);gfx.lineTo(x-22,y-16);gfx.lineTo(x-22,y-6);gfx.closePath();gfx.fillPath();
        gfx.fillStyle(0xddaaaa,0.5);gfx.beginPath();gfx.moveTo(x-52,y+5);gfx.lineTo(x-46,y+1);gfx.lineTo(x-46,y+9);gfx.closePath();gfx.fillPath();
        gfx.lineStyle(1,0xcc8888,0.4);gfx.beginPath();gfx.moveTo(x-52,y+5);gfx.lineTo(x-56,y+5);gfx.strokePath();
        gfx.lineStyle(0.5,0x662020,0.18);gfx.beginPath();gfx.moveTo(x-42,y+3);gfx.lineTo(x+42,y+6);gfx.strokePath();
        gfx.lineStyle(0.5,0x662020,0.12);gfx.beginPath();gfx.moveTo(x-6,y-5);gfx.lineTo(x-6,y+16);gfx.strokePath();
        gfx.fillStyle(0xcc4444,0.35);gfx.fillCircle(x+8,y+6,5);
        gfx.fillStyle(0xff6666,0.3);gfx.beginPath();gfx.moveTo(x+8,y+2);gfx.lineTo(x+9.5,y+5);gfx.lineTo(x+13,y+5.5);gfx.lineTo(x+10,y+7.5);gfx.lineTo(x+11,y+11);gfx.lineTo(x+8,y+9);gfx.lineTo(x+5,y+11);gfx.lineTo(x+6,y+7.5);gfx.lineTo(x+3,y+5.5);gfx.lineTo(x+6.5,y+5);gfx.closePath();gfx.fillPath();
    }

    // ═══════════ POWER-UP DRAWING ═══════════

    drawPowerupStar(gfx, x, y) {
        const t = this.time.now * 0.003;
        const pulse = 0.85 + 0.15 * Math.sin(t * 2);
        const r = 14 * pulse;

        gfx.fillStyle(0x44ddff, 0.15);
        gfx.fillCircle(x, y, r * 2);

        gfx.fillStyle(0x44ddff, 0.8);
        gfx.beginPath();
        for (let i = 0; i < 8; i++) {
            const ang = (i / 8) * Math.PI * 2 - Math.PI / 2 + t * 0.5;
            const dist = i % 2 === 0 ? r : r * 0.4;
            const px = x + Math.cos(ang) * dist;
            const py = y + Math.sin(ang) * dist;
            if (i === 0) gfx.moveTo(px, py); else gfx.lineTo(px, py);
        }
        gfx.closePath();
        gfx.fillPath();

        gfx.fillStyle(0xaaeeff, 0.9);
        gfx.fillCircle(x, y, r * 0.3);

        gfx.lineStyle(1.5, 0x88eeff, 0.5);
        gfx.strokeCircle(x, y, r * 0.65);
    }

    drawPowerupHeart(gfx, x, y) {
        const t = this.time.now * 0.003;
        const pulse = 0.85 + 0.15 * Math.sin(t * 3);
        const s = pulse;

        // Outer glow
        gfx.fillStyle(0xff4466, 0.12);
        gfx.fillCircle(x, y, 20);

        // Heart using two circles + triangle (safe Phaser Graphics API)
        gfx.fillStyle(0xff4466, 0.85);
        gfx.fillCircle(x - 5 * s, y - 4 * s, 7 * s);
        gfx.fillCircle(x + 5 * s, y - 4 * s, 7 * s);
        gfx.beginPath();
        gfx.moveTo(x - 11 * s, y - 2 * s);
        gfx.lineTo(x + 11 * s, y - 2 * s);
        gfx.lineTo(x, y + 10 * s);
        gfx.closePath();
        gfx.fillPath();

        // Highlight
        gfx.fillStyle(0xff88aa, 0.6);
        gfx.fillCircle(x - 4 * s, y - 5 * s, 3 * s);
    }

    drawShieldEffect(gfx, x, y) {
        const t = this.time.now * 0.002;
        const pulse = 0.9 + 0.1 * Math.sin(t * 3);
        const r = 48 * pulse;

        gfx.lineStyle(2, 0x44ddff, 0.25 + 0.1 * Math.sin(t * 2));
        gfx.strokeCircle(x, y + 6, r);

        gfx.lineStyle(1.5, 0x88eeff, 0.15 + 0.1 * Math.sin(t * 4));
        gfx.strokeCircle(x, y + 6, r * 0.75);

        for (let i = 0; i < 4; i++) {
            const ang = t + (i / 4) * Math.PI * 2;
            const sx = x + Math.cos(ang) * r * 0.9;
            const sy = y + 6 + Math.sin(ang) * r * 0.9;
            gfx.fillStyle(0xaaeeff, 0.4 + 0.3 * Math.sin(t * 5 + i));
            gfx.fillCircle(sx, sy, 2);
        }

        if (this.shieldTimer <= 3 && this.shieldTimer > 0) {
            const flash = Math.sin(t * 12) > 0 ? 0.3 : 0.05;
            gfx.fillStyle(0x44ddff, flash);
            gfx.fillCircle(x, y + 6, r * 0.6);
        }
    }

    // ═══════════ TOUCH CONTROLS DRAWING ═══════════

    drawTouchControls() {
        this.touchGfx.clear();

        const j = this.joystick;
        const f = this.fireBtn;
        const p = this.pauseBtn;

        // ── Joystick base ──
        this.touchGfx.fillStyle(0xffffff, 0.06);
        this.touchGfx.fillCircle(j.baseX, j.baseY, j.radius);
        this.touchGfx.lineStyle(1.5, 0xffffff, 0.15);
        this.touchGfx.strokeCircle(j.baseX, j.baseY, j.radius);

        // Track lines
        this.touchGfx.fillStyle(0xffffff, 0.08);
        this.touchGfx.fillRect(j.baseX - 3, j.baseY - j.radius + 8, 6, j.radius * 2 - 16);

        // Arrow hints
        this.touchGfx.fillStyle(0xffffff, 0.2);
        // Up arrow
        this.touchGfx.beginPath();
        this.touchGfx.moveTo(j.baseX, j.baseY - j.radius + 6);
        this.touchGfx.lineTo(j.baseX - 8, j.baseY - j.radius + 18);
        this.touchGfx.lineTo(j.baseX + 8, j.baseY - j.radius + 18);
        this.touchGfx.closePath();
        this.touchGfx.fillPath();
        // Down arrow
        this.touchGfx.beginPath();
        this.touchGfx.moveTo(j.baseX, j.baseY + j.radius - 6);
        this.touchGfx.lineTo(j.baseX - 8, j.baseY + j.radius - 18);
        this.touchGfx.lineTo(j.baseX + 8, j.baseY + j.radius - 18);
        this.touchGfx.closePath();
        this.touchGfx.fillPath();

        // Knob
        const knobAlpha = j.active ? 0.5 : 0.25;
        this.touchGfx.fillStyle(0x44aadd, knobAlpha);
        this.touchGfx.fillCircle(j.baseX, j.knobY, j.knobRadius);
        this.touchGfx.lineStyle(1.5, 0x66ccee, knobAlpha + 0.1);
        this.touchGfx.strokeCircle(j.baseX, j.knobY, j.knobRadius);

        // ── Fire button ──
        const fireAlpha = f.active ? 0.4 : 0.15;
        this.touchGfx.fillStyle(0xff4444, fireAlpha);
        this.touchGfx.fillCircle(f.x, f.y, f.radius);
        this.touchGfx.lineStyle(2, 0xff6666, fireAlpha + 0.1);
        this.touchGfx.strokeCircle(f.x, f.y, f.radius);

        // Crosshair on fire button
        this.touchGfx.lineStyle(2, 0xffffff, fireAlpha + 0.05);
        this.touchGfx.beginPath();
        this.touchGfx.moveTo(f.x - 15, f.y); this.touchGfx.lineTo(f.x + 15, f.y);
        this.touchGfx.strokePath();
        this.touchGfx.beginPath();
        this.touchGfx.moveTo(f.x, f.y - 15); this.touchGfx.lineTo(f.x, f.y + 15);
        this.touchGfx.strokePath();
        this.touchGfx.lineStyle(1.5, 0xffffff, fireAlpha);
        this.touchGfx.strokeCircle(f.x, f.y, 12);

        // ── Pause button (top-right) ──
        this.touchGfx.fillStyle(0xffffff, 0.06);
        this.touchGfx.fillCircle(p.x, p.y, p.radius);
        this.touchGfx.lineStyle(1, 0xffffff, 0.15);
        this.touchGfx.strokeCircle(p.x, p.y, p.radius);
        // Pause icon (two bars)
        this.touchGfx.fillStyle(0xffffff, 0.3);
        this.touchGfx.fillRect(p.x - 7, p.y - 9, 5, 18);
        this.touchGfx.fillRect(p.x + 2, p.y - 9, 5, 18);
    }

    // ═══════════ MISSILE ═══════════

    drawMissile(gfx,x,y){
        for(let i=0;i<3;i++){gfx.fillStyle(0xaaaaaa,0.15-i*0.04);gfx.fillCircle(x-10-i*8+(Math.random()-0.5)*3,y+(Math.random()-0.5)*3,3+i*1.5);}
        const fl=6+Math.random()*5;
        gfx.fillStyle(0xff6600,0.7);gfx.beginPath();gfx.moveTo(x-6,y-2);gfx.lineTo(x-6,y+2);gfx.lineTo(x-6-fl,y);gfx.closePath();gfx.fillPath();
        gfx.fillStyle(0xffaa00,0.8);gfx.beginPath();gfx.moveTo(x-6,y-1);gfx.lineTo(x-6,y+1);gfx.lineTo(x-6-fl*0.5,y);gfx.closePath();gfx.fillPath();
        gfx.fillStyle(0x888888);gfx.fillRect(x-6,y-2.5,14,5);gfx.fillStyle(0xaaaaaa,0.5);gfx.fillRect(x-6,y-2.5,14,2);
        gfx.fillStyle(0xcc3333);gfx.beginPath();gfx.moveTo(x+8,y-2.5);gfx.lineTo(x+8,y+2.5);gfx.lineTo(x+14,y);gfx.closePath();gfx.fillPath();
        gfx.fillStyle(0x666666);gfx.beginPath();gfx.moveTo(x-4,y-2.5);gfx.lineTo(x-8,y-6);gfx.lineTo(x-6,y-2.5);gfx.closePath();gfx.fillPath();
        gfx.beginPath();gfx.moveTo(x-4,y+2.5);gfx.lineTo(x-8,y+6);gfx.lineTo(x-6,y+2.5);gfx.closePath();gfx.fillPath();
    }

    // ═══════════ HUD ═══════════

    createHUD(){
        this.hudBg=this.add.graphics().setDepth(20);
        this.hudLevelText=this.add.text(0,0,'',{fontFamily:'Arial Black, sans-serif',fontSize:'16px',color:'#ffffff'}).setDepth(21);
        this.hudTimerText=this.add.text(0,0,'',{fontFamily:'Courier New, monospace',fontSize:'18px',color:'#ffffff'}).setDepth(21);
        this.hudLivesText=this.add.text(0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'18px',color:'#ff6666'}).setDepth(21);
        this.hudScoreText=this.add.text(0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'16px',color:'#ffdd44'}).setDepth(21);
        this.hudShieldText=this.add.text(0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'13px',color:'#44ddff'}).setDepth(21);
    }

    updateHUD(){
        this.hudBg.clear();
        this.hudBg.fillStyle(0x000000,0.55);this.hudBg.fillRoundedRect(10,8,1260,42,8);
        this.hudBg.lineStyle(1,0x446688,0.3);this.hudBg.strokeRoundedRect(10,8,1260,42,8);
        this.hudBg.fillStyle(0x446688,0.3);this.hudBg.fillRect(230,16,1,26);this.hudBg.fillRect(500,16,1,26);this.hudBg.fillRect(730,16,1,26);
        const tr=Math.max(0,this.timeLeft/Math.round(this.cfg.levelTime));
        this.hudBg.fillStyle(0x334455,0.5);this.hudBg.fillRoundedRect(320,22,150,14,4);
        const bc=tr>0.3?0x44aa66:(tr>0.15?0xddaa33:0xdd3333);
        this.hudBg.fillStyle(bc,0.7);this.hudBg.fillRoundedRect(320,22,150*tr,14,4);
        this.hudBg.fillStyle(0x2255aa,0.6);this.hudBg.fillRoundedRect(22,14,90,30,6);
        this.hudLevelText.setText(`LVL ${this.level}`).setPosition(40,20);
        const s=this.timeLeft%60;
        this.hudTimerText.setText(`${Math.floor(this.timeLeft/60)}:${s.toString().padStart(2,'0')}`).setPosition(252,19);
        this.hudLivesText.setText('♥'.repeat(Math.max(0,this.lives))+'♡'.repeat(Math.max(0,3-this.lives))).setPosition(520,19);
        this.hudScoreText.setText(`SCORE  ${this.score}`).setPosition(752,20);
        if(!this.hudTotalText)this.hudTotalText=this.add.text(0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'13px',color:'#8899aa'}).setDepth(21);
        this.hudTotalText.setText(`TOTAL  ${this.totalScore+this.score}`).setPosition(1080,22);

        if (this.shieldActive) {
            this.hudShieldText.setText(`🛡 ${this.shieldTimer}s`).setPosition(640,22).setVisible(true);
            this.hudBg.fillStyle(0x44ddff,0.3);this.hudBg.fillRoundedRect(680,24,60,10,3);
            const sr = Math.max(0, this.shieldTimer / 15);
            this.hudBg.fillStyle(0x44ddff,0.7);this.hudBg.fillRoundedRect(680,24,60*sr,10,3);
        } else {
            this.hudShieldText.setVisible(false);
        }
    }

    // ═══════════ MODAL ═══════════

    createModal(title,lines,buttons){
        const el=[],w=520,h=340,cx=640,cy=360,x0=cx-w/2,y0=cy-h/2;
        el.push(this.add.rectangle(640,360,1280,720,0x000000,0.5).setDepth(50));
        const sh=this.add.graphics().setDepth(50);sh.fillStyle(0x000000,0.3);sh.fillRoundedRect(x0+6,y0+6,w,h,16);el.push(sh);
        const pn=this.add.graphics().setDepth(51);pn.fillGradientStyle(0x0c1a2e,0x0c1a2e,0x162a44,0x162a44);pn.fillRoundedRect(x0,y0,w,h,16);pn.lineStyle(1.5,0x335577,0.6);pn.strokeRoundedRect(x0,y0,w,h,16);el.push(pn);
        el.push(this.add.text(cx,y0+40,title,{fontFamily:'Arial Black, Impact, sans-serif',fontSize:'34px',color:'#ffffff',stroke:'#1a4477',strokeThickness:1}).setOrigin(0.5).setDepth(52));
        const sp=this.add.graphics().setDepth(52);sp.fillStyle(0x4488bb,0.4);sp.fillRoundedRect(cx-180,y0+65,360,2,1);el.push(sp);
        let ly=y0+95;
        lines.forEach(line=>{
            const p=line.split(':');
            if(p.length===2){
                el.push(this.add.text(cx-10,ly,p[0].trim(),{fontFamily:'Arial, sans-serif',fontSize:'18px',color:'#8899aa'}).setOrigin(1,0).setDepth(52));
                el.push(this.add.text(cx+10,ly,p[1].trim(),{fontFamily:'Arial, sans-serif',fontSize:'18px',color:'#ddeeff'}).setOrigin(0,0).setDepth(52));
            } else {
                el.push(this.add.text(cx,ly,line,{fontFamily:'Arial, sans-serif',fontSize:'18px',color:'#bbccdd',align:'center'}).setOrigin(0.5,0).setDepth(52));
            }
            ly+=30;
        });
        const bY=y0+h-55,bS=buttons.length===1?0:220,sX=cx-(bS*(buttons.length-1))/2;
        buttons.forEach((btn,i)=>{
            const bx=sX+i*bS,bw=180,bh=44,br=8;
            const bg=this.add.graphics().setDepth(52),ip=i===0;
            const dN=()=>{bg.clear();bg.fillStyle(ip?0x1a5588:0x2a2a3a,0.9);bg.fillRoundedRect(bx-bw/2,bY-bh/2,bw,bh,br);bg.lineStyle(1,ip?0x3399cc:0x555566,0.6);bg.strokeRoundedRect(bx-bw/2,bY-bh/2,bw,bh,br);};
            const dH=()=>{bg.clear();bg.fillStyle(ip?0x2277aa:0x3a3a4a,0.95);bg.fillRoundedRect(bx-bw/2,bY-bh/2,bw,bh,br);bg.lineStyle(1.5,ip?0x55bbee:0x777788,0.8);bg.strokeRoundedRect(bx-bw/2,bY-bh/2,bw,bh,br);};
            dN();el.push(bg);
            const bl=this.add.text(bx,bY,btn.label,{fontFamily:'Arial, sans-serif',fontSize:'18px',color:ip?'#ffffff':'#aabbcc'}).setOrigin(0.5).setDepth(53);el.push(bl);
            const hz=this.add.rectangle(bx,bY,bw,bh,0x000000,0).setInteractive({useHandCursor:true}).setDepth(54);el.push(hz);
            hz.on('pointerover',()=>{dH();bl.setColor('#ffffff');});hz.on('pointerout',()=>{dN();bl.setColor(ip?'#ffffff':'#aabbcc');});
            hz.on('pointerdown',()=>{el.forEach(e=>e.destroy());btn.callback();});
        });
        return el;
    }

    // ═══════════ CHEAT ═══════════

    openCheat(){this.cheatActive=true;this.cheatText='';const g=this.add.graphics().setDepth(50);g.fillStyle(0x0a1525,0.9);g.fillRoundedRect(920,18,340,40,8);g.lineStyle(1,0x4488aa,0.6);g.strokeRoundedRect(920,18,340,40,8);this.cheatBox=g;this.cheatLabel=this.add.text(935,30,'LEVEL ▸',{fontFamily:'Courier New, monospace',fontSize:'16px',color:'#557799'}).setDepth(51);this.cheatDisplay=this.add.text(1020,30,'',{fontFamily:'Courier New, monospace',fontSize:'18px',color:'#55ddff'}).setDepth(51);}
    closeCheat(){this.cheatActive=false;if(this.cheatBox)this.cheatBox.destroy();if(this.cheatLabel)this.cheatLabel.destroy();if(this.cheatDisplay)this.cheatDisplay.destroy();}

    // ═══════════ SCREENS ═══════════

    showPauseMenu(){this.isPaused=true;const t=this.totalScore+this.score;
        const lines = [`Score niveau : ${this.score}`,`Score total : ${t}`,`Vies : ${'♥'.repeat(this.lives)}`,`Temps restant : ${this.timeLeft}s`];
        if (this.shieldActive) lines.push(`Bouclier : ${this.shieldTimer}s`);
        this.createModal('PAUSE',lines,
        [{label:'▶  Reprendre',callback:()=>{this.isPaused=false;}},{label:'✕  Quitter',callback:()=>{this.scene.start('Start');}}]);}

    showGameOver(){this.isPaused=true;const t=this.totalScore+this.score;
        if(this.audio)this.audio.playGameOver();
        this.createModal('GAME OVER',[`Score niveau : ${this.score}`,`Score total : ${t}`],
        [{label:'↺  Recommencer',callback:()=>{this.scene.restart({level:this.level,totalScore:this.totalScore});}},{label:'✕  Quitter',callback:()=>{this.scene.start('Start');}}]);}

    endLevel(){
        this.isPaused=true;
        let livesBonus = 0;
        if (this.lives === 3) livesBonus = 30;
        else if (this.lives === 2) livesBonus = 15;
        this.score += livesBonus;
        const newTotal=this.totalScore+this.score;

        if(this.audio)this.audio.playVictory();

        const lines = [
            `Score niveau : ${this.score}`,
            `Score total : ${newTotal}`,
            `Ennemis abattus : ${this.kills}`,
            `Vies restantes : ${'♥'.repeat(Math.max(0,this.lives))}`,
        ];
        if (livesBonus > 0) {
            lines.push(`Bonus vies : +${livesBonus} pts`);
        }

        this.createModal(`NIVEAU ${this.level} TERMINÉ`, lines,
        [{label:'▶  Niveau suivant',callback:()=>{this.scene.restart({level:this.level+1,totalScore:newTotal});}},{label:'✕  Quitter',callback:()=>{this.scene.start('Start');}}]);
    }

    // ═══════════ UPDATE ═══════════

    update(){
        this.updateHUD();
        this.updateFx();

        if(this.ctrlKey.isDown&&Phaser.Input.Keyboard.JustDown(this.xKey)&&!this.cheatActive)this.openCheat();
        if(this.cheatActive){this.cheatDisplay.setText(this.cheatText);return;}
        if(Phaser.Input.Keyboard.JustDown(this.escKey)&&!this.isPaused)this.showPauseMenu();
        if(this.isPaused)return;
        if(this.lives<=0){this.showGameOver();return;}

        // ── Movement: keyboard + joystick ──
        let moveDir = 0;
        if(this.cursors.up.isDown) moveDir = -1;
        if(this.cursors.down.isDown) moveDir = 1;

        // Joystick: map knob offset to movement
        if (this.joystick.active) {
            const offset = this.joystick.knobY - this.joystick.baseY;
            const deadzone = 8;
            if (Math.abs(offset) > deadzone) {
                moveDir = offset / this.joystick.radius; // -1..1
            }
        }

        this.player.y += moveDir * this.cfg.playerSpeed;
        this.player.y=Phaser.Math.Clamp(this.player.y,50,680);

        // ── Shooting: keyboard + touch fire button ──
        let wantsToFire = Phaser.Input.Keyboard.JustDown(this.spaceKey);

        // Touch fire: continuous fire with cooldown
        if (this.fireBtn.active) {
            this.touchFireCooldown--;
            if (this.touchFireCooldown <= 0) {
                wantsToFire = true;
                this.touchFireCooldown = 12; // ~200ms at 60fps
            }
        } else {
            this.touchFireCooldown = 0;
        }

        if(wantsToFire){
            this.bullets.push({x:this.player.x+40,y:this.player.y,gfx:this.add.graphics().setDepth(7)});
            if(this.audio)this.audio.playShoot();
        }

        // ── Player drawing ──
        this.player.gfx.clear();
        if(!this.player.hit||Math.floor(this.player.hitTimer/5)%2===0)this.drawPlayerPlane(this.player.gfx,this.player.x,this.player.y);
        if(this.player.hit){this.player.hitTimer++;if(this.player.hitTimer>60){this.player.hit=false;this.player.hitTimer=0;}}

        // ── Shield visual ──
        this.shieldGfx.clear();
        if (this.shieldActive) {
            this.drawShieldEffect(this.shieldGfx, this.player.x, this.player.y);
        }

        // ── Bullets — reverse iteration ──
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            b.x += this.cfg.missileSpeed;
            b.gfx.clear();
            this.drawMissile(b.gfx, b.x, b.y);
            if (b.x > 1300) {
                b.gfx.destroy();
                this.bullets.splice(i, 1);
            }
        }

        // ── Enemies — reverse iteration ──
        for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
            const e = this.enemies[ei];
            e.x -= this.cfg.enemySpeed;
            e.gfx.clear();
            this.drawEnemyPlane(e.gfx, e.x, e.y);

            // Player collision
            if (!this.player.hit && Phaser.Math.Distance.Between(e.x, e.y, this.player.x, this.player.y) < 40) {
                if (this.shieldActive) {
                    // Shield absorbs — destroy enemy, no life lost
                    this.spawnExplosion(e.x, e.y);
                    if (this.audio) this.audio.playExplosion();
                    e.gfx.destroy();
                    this.enemies.splice(ei, 1);
                    this.score += 5;
                    continue;
                } else {
                    this.player.hit = true;
                    this.player.hitTimer = 0;
                    this.lives--;
                    const mx = (this.player.x + e.x) / 2, my = (this.player.y + e.y) / 2;
                    this.spawnCollisionFx(mx, my);
                    if (this.audio) this.audio.playHit();
                }
            }

            // Bullet collision — reverse iteration
            let enemyDestroyed = false;
            for (let bi = this.bullets.length - 1; bi >= 0; bi--) {
                const b = this.bullets[bi];
                if (Phaser.Math.Distance.Between(e.x, e.y, b.x, b.y) < 30) {
                    this.spawnExplosion(e.x, e.y);
                    if (this.audio) this.audio.playExplosion();
                    e.gfx.destroy();
                    b.gfx.destroy();
                    this.enemies.splice(ei, 1);
                    this.bullets.splice(bi, 1);
                    this.score += 10;
                    this.kills++;
                    enemyDestroyed = true;
                    break;
                }
            }
            if (enemyDestroyed) continue;

            if (e.x < -50) {
                e.gfx.destroy();
                this.enemies.splice(ei, 1);
                this.score = Math.max(0, this.score - 5);
            }
        }

        // ── Power-ups — reverse iteration ──
        this.powerupGfx.clear();
        for (let pi = this.powerups.length - 1; pi >= 0; pi--) {
            const pu = this.powerups[pi];
            pu.x -= pu.speed;

            if (pu.type === 'star') {
                this.drawPowerupStar(this.powerupGfx, pu.x, pu.y);
            } else {
                this.drawPowerupHeart(this.powerupGfx, pu.x, pu.y);
            }

            // Player pickup
            if (Phaser.Math.Distance.Between(pu.x, pu.y, this.player.x, this.player.y) < 45) {
                this.spawnPickupFx(pu.x, pu.y, pu.type);

                if (pu.type === 'star') {
                    this.shieldActive = true;
                    this.shieldTimer = 15;
                    if (this.audio) this.audio.playVictory();
                } else {
                    if (this.lives < 3) {
                        this.lives++;
                        if (this.audio) this.audio.playVictory();
                    } else {
                        this.score += 15;
                        if (this.audio) this.audio.playVictory();
                    }
                }

                this.powerups.splice(pi, 1);
                continue;
            }

            if (pu.x < -30) {
                this.powerups.splice(pi, 1);
            }
        }

        // ── Clouds ──
        this.farCloudGfx.clear();
        this.farClouds.forEach(c=>{c.x-=0.5;if(c.x<-150){c.x=1400;c.y=Phaser.Math.Between(60,350);}this.drawCloud(this.farCloudGfx,c.x,c.y,c.scale);});
        this.nearCloudGfx.clear();
        this.nearClouds.forEach(c=>{c.x-=1.2;if(c.x<-180){c.x=1450;c.y=Phaser.Math.Between(100,600);}this.drawCloud(this.nearCloudGfx,c.x,c.y,c.scale);});

        // ── Touch controls overlay ──
        this.drawTouchControls();
    }
}
