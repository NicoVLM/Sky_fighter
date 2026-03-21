export class Start extends Phaser.Scene {
    constructor() {
        super('Start');
    }

    create() {
        this.stars = [];
        this.menuElements = [];
        this.bgGfx = this.add.graphics().setDepth(0);
        this.starGfx = this.add.graphics().setDepth(1);
        this.planeGfx = this.add.graphics().setDepth(3);
        this.planeX = -200;
        this.planeY = 520;

        this.drawBackground();
        this.createStars();

        if (!this.registry.get('audioEngine')) {
            this.registry.set('audioEngine', new SkyAudio());
        }
        this.audio = this.registry.get('audioEngine');

        this.input.once('pointerdown', () => {
            this.audio.init();
            if (!this.audio.muted) this.audio.startMusic();
        });

        this.showMenu();
    }

    update() {
        this.starGfx.clear();
        const t = this.time.now * 0.001;
        this.stars.forEach(s => {
            const flicker = 0.5 + 0.5 * Math.sin(t * s.speed + s.phase);
            this.starGfx.fillStyle(0xffffff, flicker * s.maxAlpha);
            this.starGfx.fillCircle(s.x, s.y, s.size);
            if (s.size > 1.5) {
                this.starGfx.fillStyle(0xffffff, flicker * s.maxAlpha * 0.15);
                this.starGfx.fillCircle(s.x, s.y, s.size * 3);
            }
        });
        this.planeX += 1.5;
        if (this.planeX > 1500) { this.planeX = -200; this.planeY = Phaser.Math.Between(440, 600); }
        this.planeGfx.clear();
        this.drawDecorativePlane(this.planeGfx, this.planeX, this.planeY, 0.5);
    }

    drawBackground() {
        this.bgGfx.fillGradientStyle(0x020010, 0x020010, 0x0a1a3a, 0x0a1a3a);
        this.bgGfx.fillRect(0, 0, 1280, 720);
        this.bgGfx.fillGradientStyle(0x0a1a3a, 0x0a1a3a, 0x15304a, 0x1a3855);
        this.bgGfx.fillRect(0, 500, 1280, 220);
        const nebColors = [0x331155, 0x112255, 0x1a0a44];
        for (let i = 0; i < 6; i++) {
            const nx = Phaser.Math.Between(100, 1180), ny = Phaser.Math.Between(50, 400), nr = Phaser.Math.Between(80, 180);
            this.bgGfx.fillStyle(nebColors[i % 3], 0.08); this.bgGfx.fillCircle(nx, ny, nr);
            this.bgGfx.fillStyle(nebColors[(i + 1) % 3], 0.05); this.bgGfx.fillCircle(nx + 30, ny - 20, nr * 0.7);
        }
    }

    createStars() {
        for (let i = 0; i < 150; i++) {
            this.stars.push({ x: Math.random()*1280, y: Math.random()*720, size: Math.random()*2+0.3, maxAlpha: Math.random()*0.6+0.4, speed: Math.random()*3+1, phase: Math.random()*Math.PI*2 });
        }
    }

    drawDecorativePlane(gfx, x, y, s) {
        const flameLen = 15 + Math.random() * 12;
        gfx.fillStyle(0xff6600, 0.4);
        gfx.beginPath(); gfx.moveTo(x-38*s,y+2*s); gfx.lineTo(x-38*s,y+8*s); gfx.lineTo(x-(38+flameLen)*s,y+5*s); gfx.closePath(); gfx.fillPath();
        gfx.fillStyle(0x5580aa, 0.5);
        gfx.beginPath(); gfx.moveTo(x+44*s,y+4*s); gfx.lineTo(x+30*s,y-2*s); gfx.lineTo(x-20*s,y-2*s); gfx.lineTo(x-38*s,y+2*s);
        gfx.lineTo(x-38*s,y+10*s); gfx.lineTo(x-20*s,y+12*s); gfx.lineTo(x+30*s,y+10*s); gfx.closePath(); gfx.fillPath();
        gfx.fillStyle(0x446688, 0.5);
        gfx.beginPath(); gfx.moveTo(x+12*s,y-2*s); gfx.lineTo(x-8*s,y-2*s); gfx.lineTo(x-22*s,y-6*s); gfx.lineTo(x+4*s,y-6*s); gfx.closePath(); gfx.fillPath();
        gfx.beginPath(); gfx.moveTo(x-28*s,y+2*s); gfx.lineTo(x-38*s,y-18*s); gfx.lineTo(x-42*s,y-16*s); gfx.lineTo(x-38*s,y+2*s); gfx.closePath(); gfx.fillPath();
        gfx.fillStyle(0x66ddff, 0.4); gfx.fillEllipse(x+20*s, y-1*s, 12*s, 6*s);
    }

    showMenu() {
        this.clearMenu();
        const ts = this.add.text(643,123,'SKY FIGHTER',{fontFamily:'Arial Black, Impact, sans-serif',fontSize:'72px',color:'#000000'}).setOrigin(0.5).setAlpha(0.5).setDepth(10); this.menuElements.push(ts);
        const t = this.add.text(640,120,'SKY FIGHTER',{fontFamily:'Arial Black, Impact, sans-serif',fontSize:'72px',color:'#ffffff',stroke:'#2266aa',strokeThickness:2}).setOrigin(0.5).setDepth(10); this.menuElements.push(t);
        const lg = this.add.graphics().setDepth(10); lg.fillStyle(0x4488cc,0.6); lg.fillRoundedRect(380,168,520,3,1); lg.fillStyle(0x66aaee,0.2); lg.fillRoundedRect(380,166,520,7,3); this.menuElements.push(lg);
        const sub = this.add.text(640,195,'ARCADE  SHOOTER',{fontFamily:'Arial, sans-serif',fontSize:'16px',color:'#5588aa',letterSpacing:10}).setOrigin(0.5).setDepth(10); this.menuElements.push(sub);

        this.createStyledButton(640, 320, '▶   JOUER', () => { this.scene.start('Game'); });
        this.createStyledButton(640, 405, '⌨   COMMANDES', () => { this.showControls(); });
        this.createStyledButton(640, 490, '✕   QUITTER', () => { window.close(); });

        this.audio = this.registry.get('audioEngine');
        const muteLabel = this.audio && this.audio.muted ? '🔇' : '🔊';
        const muteBtn = this.add.text(1240, 680, muteLabel, { fontSize: '28px', color: '#445566' })
            .setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(12);
        muteBtn.on('pointerdown', () => {
            if (!this.audio) return;
            this.audio.init();
            this.audio.toggleMute();
            muteBtn.setText(this.audio.muted ? '🔇' : '🔊');
        });
        muteBtn.on('pointerover', () => muteBtn.setColor('#aaccee'));
        muteBtn.on('pointerout', () => muteBtn.setColor('#445566'));
        this.menuElements.push(muteBtn);

        const footer = this.add.text(640,662,'↑↓ / Joystick  Se déplacer   •   ESPACE / Bouton  Tirer   •   ÉCHAP / ⏸  Pause',{fontFamily:'Arial, sans-serif',fontSize:'12px',color:'#334455'}).setOrigin(0.5).setDepth(10); this.menuElements.push(footer);
        const copy = this.add.text(640,690,'© 2026 NicoVLM. Tous droits réservés.',{fontFamily:'Arial, sans-serif',fontSize:'11px',color:'#223344'}).setOrigin(0.5).setDepth(10); this.menuElements.push(copy);
    }

    showControls() {
        this.clearMenu();
        const pg = this.add.graphics().setDepth(10); pg.fillStyle(0x0a1525,0.88); pg.fillRoundedRect(190,60,900,600,16); pg.lineStyle(1.5,0x334466,0.7); pg.strokeRoundedRect(190,60,900,600,16); this.menuElements.push(pg);
        const tt = this.add.text(640,105,'COMMANDES',{fontFamily:'Arial Black, Impact, sans-serif',fontSize:'42px',color:'#ffffff',stroke:'#2266aa',strokeThickness:1}).setOrigin(0.5).setDepth(11); this.menuElements.push(tt);
        const sg = this.add.graphics().setDepth(11); sg.fillStyle(0x4488cc,0.4); sg.fillRoundedRect(290,139,700,2,1); this.menuElements.push(sg);

        // ── Keyboard section ──
        const kbTitle = this.add.text(640,170,'⌨  CLAVIER',{fontFamily:'Arial Black, sans-serif',fontSize:'18px',color:'#55bbdd'}).setOrigin(0.5).setDepth(12); this.menuElements.push(kbTitle);

        const ctrls = [{key:'↑  ↓',action:'Monter / Descendre'},{key:'ESPACE',action:'Tirer un missile'},{key:'ÉCHAP',action:'Menu pause'}];
        ctrls.forEach((c, i) => {
            const y = 220 + i * 65;
            const kb = this.add.graphics().setDepth(11); kb.fillStyle(0x0d1e30,1); kb.fillRoundedRect(270,y-20,160,40,8); kb.lineStyle(1,0x2a5577,0.8); kb.strokeRoundedRect(270,y-20,160,40,8); this.menuElements.push(kb);
            this.menuElements.push(this.add.text(350,y,c.key,{fontFamily:'Courier New, monospace',fontSize:'18px',color:'#55bbdd'}).setOrigin(0.5).setDepth(12));
            this.menuElements.push(this.add.text(450,y,'→',{fontSize:'18px',color:'#445566'}).setOrigin(0.5).setDepth(12));
            this.menuElements.push(this.add.text(480,y,c.action,{fontFamily:'Arial, sans-serif',fontSize:'18px',color:'#bbccdd'}).setOrigin(0,0.5).setDepth(12));
        });

        // ── Separator ──
        const sep = this.add.graphics().setDepth(11); sep.fillStyle(0x334466,0.5); sep.fillRect(290,420,700,1); this.menuElements.push(sep);

        // ── Touch section ──
        const tcTitle = this.add.text(640,448,'👆  TACTILE',{fontFamily:'Arial Black, sans-serif',fontSize:'18px',color:'#55bbdd'}).setOrigin(0.5).setDepth(12); this.menuElements.push(tcTitle);

        const touchCtrls = [
            {icon:'◯',desc:'Joystick gauche → Monter / Descendre'},
            {icon:'◎',desc:'Bouton droit → Tir continu'},
            {icon:'⏸',desc:'Bouton pause en haut à droite'},
        ];
        touchCtrls.forEach((c, i) => {
            const y = 495 + i * 40;
            this.menuElements.push(this.add.text(320,y,c.icon,{fontSize:'18px',color:'#44aadd'}).setOrigin(0.5).setDepth(12));
            this.menuElements.push(this.add.text(350,y,c.desc,{fontFamily:'Arial, sans-serif',fontSize:'16px',color:'#99aabb'}).setOrigin(0,0.5).setDepth(12));
        });

        this.createStyledButton(640, 620, '←   RETOUR', () => { this.showMenu(); });
    }

    createStyledButton(x, y, label, callback) {
        const w=300,h=54,r=10;
        const bg = this.add.graphics().setDepth(10);
        const dN = () => { bg.clear(); bg.fillStyle(0x0d1f33,0.9); bg.fillRoundedRect(x-w/2,y-h/2,w,h,r); bg.lineStyle(1.5,0x2a6699,0.6); bg.strokeRoundedRect(x-w/2,y-h/2,w,h,r); };
        const dH = () => { bg.clear(); bg.fillStyle(0x1a3350,0.95); bg.fillRoundedRect(x-w/2,y-h/2,w,h,r); bg.lineStyle(2,0x44aadd,0.9); bg.strokeRoundedRect(x-w/2,y-h/2,w,h,r); bg.fillStyle(0x44aadd,0.06); bg.fillRoundedRect(x-w/2-4,y-h/2-4,w+8,h+8,r+4); };
        dN(); this.menuElements.push(bg);
        const bt = this.add.text(x,y,label,{fontFamily:'Arial, sans-serif',fontSize:'22px',color:'#99bbdd'}).setOrigin(0.5).setDepth(11); this.menuElements.push(bt);
        const hz = this.add.rectangle(x,y,w,h,0x000000,0).setInteractive({useHandCursor:true}).setDepth(12); this.menuElements.push(hz);
        hz.on('pointerover',()=>{dH();bt.setColor('#ffffff');}); hz.on('pointerout',()=>{dN();bt.setColor('#99bbdd');}); hz.on('pointerdown',callback);
        return hz;
    }

    clearMenu() { this.menuElements.forEach(el => el.destroy()); this.menuElements = []; }
}

// ════════════════════════════════════════════════════════
//  PROCEDURAL CHIPTUNE AUDIO ENGINE
// ════════════════════════════════════════════════════════

export class SkyAudio {
    constructor() {
        this.ctx = null;
        this.muted = false;
        this.initialized = false;
        this.masterGain = null;
        this.musicTimer = null;
        this.musicRunning = false;
    }

    init() {
        if (this.initialized) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : 1;
        this.masterGain.connect(this.ctx.destination);
        this.initialized = true;
    }

    toggleMute() {
        this.muted = !this.muted;
        if (this.masterGain) this.masterGain.gain.value = this.muted ? 0 : 1;
        if (!this.muted && !this.musicRunning) this.startMusic();
    }

    // ── Helpers ──

    _osc(type, freq, vol, start, dur, dest) {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, start);
        g.gain.setValueAtTime(vol, start);
        g.gain.setValueAtTime(vol, start + dur * 0.8);
        g.gain.linearRampToValueAtTime(0, start + dur);
        o.connect(g);
        g.connect(dest || this.masterGain);
        o.start(start);
        o.stop(start + dur + 0.02);
        return o;
    }

    _sweep(type, freqStart, freqEnd, vol, start, dur, dest) {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freqStart, start);
        o.frequency.exponentialRampToValueAtTime(freqEnd, start + dur);
        g.gain.setValueAtTime(vol, start);
        g.gain.linearRampToValueAtTime(0, start + dur);
        o.connect(g);
        g.connect(dest || this.masterGain);
        o.start(start);
        o.stop(start + dur + 0.02);
        return o;
    }

    _noise(dur, vol, start, dest) {
        const sr = this.ctx.sampleRate;
        const len = Math.floor(sr * dur);
        const buf = this.ctx.createBuffer(1, len, sr);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(vol, start);
        g.gain.exponentialRampToValueAtTime(0.001, start + dur);
        src.connect(g);
        g.connect(dest || this.masterGain);
        src.start(start);
        src.stop(start + dur + 0.02);
    }

    // ══════════════════════════════════════════
    //  CHIPTUNE MUSIC — Megaman-inspired
    //
    //  Fast 150bpm, square wave melody,
    //  pulse bass, triangle arps, noise drums
    // ══════════════════════════════════════════

    startMusic() {
        if (!this.ctx) return;
        this.stopMusic();
        this.musicRunning = true;

        const bpm = 150;
        const s = 60 / bpm;           // 1 sixteenth = s/4
        const q = s;                   // quarter note
        const e = q / 2;              // eighth note
        const sx = q / 4;             // sixteenth note

        // Note frequencies
        const N = {
            C3:130.81,D3:146.83,E3:164.81,F3:174.61,G3:196.00,A3:220.00,B3:246.94,
            C4:261.63,D4:293.66,E4:329.63,F4:349.23,G4:392.00,A4:440.00,B4:493.88,
            C5:523.25,D5:587.33,E5:659.25,F5:698.46,G5:783.99,A5:880.00,B5:987.77,
            C6:1046.50,
            R:0 // rest
        };

        const musicGain = this.ctx.createGain();
        musicGain.gain.value = 0.12;
        musicGain.connect(this.masterGain);

        const bassGain = this.ctx.createGain();
        bassGain.gain.value = 0.10;
        bassGain.connect(this.masterGain);

        const arpGain = this.ctx.createGain();
        arpGain.gain.value = 0.05;
        arpGain.connect(this.masterGain);

        const drumGain = this.ctx.createGain();
        drumGain.gain.value = 0.08;
        drumGain.connect(this.masterGain);

        // ── Melody (square wave, heroic & driving) ──
        const melody = [
            // Bar 1-2: Opening riff
            [N.E5,e],[N.E5,sx],[N.R,sx],[N.E5,e],[N.R,e],[N.C5,e],[N.E5,e],
            [N.G5,q],[N.R,q],
            // Bar 3-4
            [N.G4,q],[N.R,q],[N.E4,q],[N.R,q],
            // Bar 5-6: Rising phrase
            [N.C5,e],[N.D5,e],[N.E5,e],[N.R,e],
            [N.E5,e],[N.F5,e],[N.G5,e],[N.R,e],
            // Bar 7-8: Peak phrase
            [N.A5,e],[N.G5,e],[N.E5,q],
            [N.D5,e],[N.E5,e],[N.C5,q],
            // Bar 9-10: Second theme
            [N.G5,e],[N.F5,sx],[N.E5,sx],[N.D5,e],[N.E5,e],
            [N.C5,e],[N.D5,e],[N.E5,e],[N.G5,e],
            // Bar 11-12: Descending run
            [N.A5,e],[N.G5,e],[N.F5,e],[N.E5,e],
            [N.D5,e],[N.C5,e],[N.D5,e],[N.E5,e],
            // Bar 13-14: Repeat opening
            [N.E5,e],[N.E5,sx],[N.R,sx],[N.E5,e],[N.R,e],[N.C5,e],[N.E5,e],
            [N.G5,q],[N.A5,q],
            // Bar 15-16: Ending phrase
            [N.G5,e],[N.E5,e],[N.C5,e],[N.D5,e],
            [N.E5,q],[N.R,q],
        ];

        // ── Bass (square, driving pulse) ──
        const bassPattern = [
            // Follows chord roots, pumping eighths
            N.C3,N.C3,N.C3,N.C3, N.C3,N.C3,N.G3,N.G3,
            N.C3,N.C3,N.C3,N.C3, N.E3,N.E3,N.E3,N.E3,
            N.A3,N.A3,N.A3,N.A3, N.A3,N.A3,N.G3,N.G3,
            N.F3,N.F3,N.F3,N.F3, N.G3,N.G3,N.G3,N.G3,
            N.C3,N.C3,N.C3,N.C3, N.C3,N.C3,N.G3,N.G3,
            N.A3,N.A3,N.A3,N.A3, N.F3,N.F3,N.F3,N.F3,
            N.D3,N.D3,N.D3,N.D3, N.G3,N.G3,N.G3,N.G3,
            N.C3,N.C3,N.C3,N.C3, N.C3,N.C3,N.G3,N.G3,
        ];

        // ── Arp (triangle wave, fast arpeggios) ──
        const arpNotes = [
            N.C4,N.E4,N.G4,N.C5, N.G4,N.E4,N.C4,N.E4,
            N.C4,N.E4,N.G4,N.C5, N.G4,N.E4,N.G4,N.B4,
            N.A3,N.C4,N.E4,N.A4, N.E4,N.C4,N.A3,N.C4,
            N.F3,N.A3,N.C4,N.F4, N.G3,N.B3,N.D4,N.G4,
            N.C4,N.E4,N.G4,N.C5, N.G4,N.E4,N.C4,N.E4,
            N.A3,N.C4,N.E4,N.A4, N.F3,N.A3,N.C4,N.F4,
            N.D4,N.F4,N.A4,N.D5, N.G3,N.B3,N.D4,N.G4,
            N.C4,N.E4,N.G4,N.C5, N.G4,N.E4,N.C4,N.E4,
        ];

        // ── Drum pattern (noise-based, repeating 2 bars) ──
        // K=kick, S=snare, H=hihat, R=rest
        const drumPattern = 'K.H.S.H.K.H.S.HHK.HHS.H.KKHHS.HH';

        const scheduleLoop = (t0) => {
            // Melody
            let mt = t0;
            melody.forEach(([freq, dur]) => {
                if (freq > 0) {
                    this._osc('square', freq, 0.6, mt, dur * 0.85, musicGain);
                }
                mt += dur;
            });

            // Bass
            bassPattern.forEach((freq, i) => {
                const bt = t0 + i * e;
                if (freq > 0) {
                    this._osc('square', freq, 0.7, bt, e * 0.7, bassGain);
                }
            });

            // Arps
            arpNotes.forEach((freq, i) => {
                const at = t0 + i * sx * 2;
                if (freq > 0) {
                    this._osc('triangle', freq, 0.5, at, sx * 1.5, arpGain);
                }
            });

            // Drums (loop the pattern across the full loop)
            const totalBeats = bassPattern.length;
            for (let i = 0; i < totalBeats * 2; i++) {
                const di = i % drumPattern.length;
                const ch = drumPattern[di];
                const dt = t0 + i * sx * 2;

                if (ch === 'K') {
                    // Kick: short sine sweep down
                    this._sweep('sine', 150, 40, 0.7, dt, 0.08, drumGain);
                } else if (ch === 'S') {
                    // Snare: noise burst
                    this._noise(0.07, 0.5, dt, drumGain);
                    this._sweep('sine', 200, 100, 0.3, dt, 0.05, drumGain);
                } else if (ch === 'H') {
                    // HiHat: short noise
                    this._noise(0.03, 0.2, dt, drumGain);
                }
            }
        };

        // Calculate loop duration
        let loopDur = 0;
        melody.forEach(([, dur]) => { loopDur += dur; });

        // Schedule loops using setInterval for indefinite play
        const now = this.ctx.currentTime + 0.1;

        // Pre-schedule first 3 loops
        for (let i = 0; i < 3; i++) {
            scheduleLoop(now + i * loopDur);
        }

        // Then keep scheduling ahead
        let nextLoop = 3;
        this.musicTimer = setInterval(() => {
            if (!this.musicRunning) return;
            const ahead = now + nextLoop * loopDur;
            const current = this.ctx.currentTime;
            if (ahead - current < loopDur * 3) {
                scheduleLoop(ahead);
                nextLoop++;
            }
        }, 1000);
    }

    stopMusic() {
        this.musicRunning = false;
        if (this.musicTimer) {
            clearInterval(this.musicTimer);
            this.musicTimer = null;
        }
    }

    // ══════════════════════════════════════════
    //  SFX
    // ══════════════════════════════════════════

    // Shoot: arcade-style descending "pew" (Air Duel inspired)
    playShoot() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;

        // Main pew: fast descending square sweep
        this._sweep('square', 1800, 200, 0.10, t, 0.07);

        // Punch layer: triangle for body
        this._sweep('triangle', 1200, 150, 0.06, t, 0.06);

        // Tiny noise click for attack transient
        this._noise(0.015, 0.08, t);
    }

    // Explosion: meaty low boom + noise + debris
    playExplosion() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;

        // Low boom sweep
        this._sweep('sine', 200, 30, 0.25, t, 0.35);

        // Mid crunch
        this._sweep('sawtooth', 400, 60, 0.08, t, 0.2);

        // Noise wash
        this._noise(0.45, 0.25, t);

        // Secondary rumble
        this._sweep('sine', 100, 20, 0.15, t + 0.1, 0.3);

        // Debris pings
        this._osc('square', 800, 0.04, t + 0.05, 0.03);
        this._osc('square', 600, 0.03, t + 0.1, 0.03);
    }

    // Player hit: alarm-style warning
    playHit() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;

        // Impact thud
        this._sweep('sine', 300, 60, 0.2, t, 0.12);
        this._noise(0.15, 0.18, t);

        // Warning beeps (two-tone alarm)
        this._osc('square', 880, 0.10, t + 0.08, 0.08);
        this._osc('square', 660, 0.10, t + 0.20, 0.08);
        this._osc('square', 880, 0.08, t + 0.32, 0.06);
    }

    // Victory: triumphant ascending fanfare (chiptune)
    playVictory() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const notes = [
            [523.25, 0.12], [587.33, 0.12], [659.25, 0.12], [783.99, 0.18],
            [659.25, 0.10], [783.99, 0.12], [1046.50, 0.40]
        ];
        let ct = t;
        notes.forEach(([f, d]) => {
            this._osc('square', f, 0.10, ct, d * 0.9);
            this._osc('triangle', f * 0.5, 0.05, ct, d);
            ct += d;
        });
        // Final chord swell
        this._osc('square', 523.25, 0.06, ct, 0.5);
        this._osc('square', 659.25, 0.06, ct, 0.5);
        this._osc('square', 783.99, 0.06, ct, 0.5);
        this._osc('triangle', 1046.50, 0.04, ct, 0.6);
    }

    // Game over: descending minor, slow & heavy
    playGameOver() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const notes = [
            [493.88, 0.30], [440.00, 0.30], [349.23, 0.30], [329.63, 0.50]
        ];
        let ct = t;
        notes.forEach(([f, d]) => {
            this._osc('square', f, 0.10, ct, d * 0.85);
            this._osc('triangle', f * 0.5, 0.06, ct, d);
            ct += d;
        });
        // Low death rumble
        this._sweep('sine', 120, 30, 0.12, t + 0.5, 1.0);
        this._noise(0.6, 0.04, t + 0.8);
    }
}
