'use strict';

/* ─────────────────────────────────────────────────────────────
   AUDIO MANAGER
───────────────────────────────────────────────────────────── */
const Audio = {
  musicOn: localStorage.getItem('bio_music') !== 'off',
  sfxOn:   localStorage.getItem('bio_sfx')   !== 'off',

  _el(id) { return document.getElementById(id); },

  /* Call once after first user interaction — browsers block autoplay */
  init(){
    if(this.musicOn) this.playMusic();
  },

  playMusic(){
    const m = this._el('bg-music');
    if(!m) return;
    m.volume = 0.35;
    m.play().catch(()=>{});
  },

  stopMusic(){
    const m = this._el('bg-music');
    if(m) m.pause();
  },

  toggleMusic(){
    this.musicOn = !this.musicOn;
    localStorage.setItem('bio_music', this.musicOn ? 'on' : 'off');
    const btn = document.getElementById('btn-music');
    if(this.musicOn){ this.playMusic(); btn && btn.classList.remove('muted'); }
    else            { this.stopMusic(); btn && btn.classList.add('muted');    }
  },

  toggleSFX(){
    this.sfxOn = !this.sfxOn;
    localStorage.setItem('bio_sfx', this.sfxOn ? 'on' : 'off');
    const btn = document.getElementById('btn-sfx');
    btn && btn.classList.toggle('muted', !this.sfxOn);
  },

  play(id, volumeOverride){
    if(!this.sfxOn) return;
    const el = this._el(id);
    if(!el) return;
    el.volume = volumeOverride ?? 0.6;
    el.currentTime = 0;
    el.play().catch(()=>{});
  },

  /* Convenience shortcuts */
  win()   { this.play('sfx-win',    0.8); },
  launch(){ this.play('sfx-launch', 0.7); },
  click() { this.play('sfx-click',  0.45); },
};

const {
  Engine, Render, Runner,
  Bodies, Body, Constraint, World, Events
} = Matter;

/* ─────────────────────────────────────────────────────────────
   PHYSICS CONSTANTS — single source of truth
   All drawn surfaces share the same friction so the ball
   never slows down unexpectedly when transitioning tools.
───────────────────────────────────────────────────────────── */
const SURF_FRICTION        = 0.04;   // ramps / planks / freehand
const SURF_FRICTION_STATIC = 0.02;
const SURF_RESTITUTION     = 0.25;

const BALL_FRICTION        = 0.04;
const BALL_FRICTION_STATIC = 0.02;
const BALL_FRICTION_AIR    = 0.0008; // nearly no air drag
const BALL_RESTITUTION     = 0.40;
const BALL_DENSITY         = 0.002;

const WEIGHT_FRICTION        = 0.35;
const WEIGHT_FRICTION_STATIC = 0.25;
const WEIGHT_RESTITUTION     = 0.20;

/* ─────────────────────────────────────────────────────────────
   LEVEL DEFINITIONS  (coords in % of canvas)
───────────────────────────────────────────────────────────── */
const LEVELS = [
  /* 1 ── Easy ramp intro */
  {
    title:"Level 1", objective:"Guide the ball into the bucket",
    clue:"Draw a diagonal ramp from the ball toward the bucket.",
    timeStar:12, shapesStar:1, shapesLimit:3, difficulty:"Easy",
    redZones:[],
    balls:[{x:15,y:15,r:18,color:"#e8a020"}],
    targets:[{x:78,y:80}],
    statics:[
      {type:"rect",x:70,y:87,w:30,h:8,color:"#2a3f58"},
      {type:"rect",x:56,y:87,w:4,h:16,color:"#2a3f58"},
      {type:"rect",x:84,y:87,w:4,h:16,color:"#2a3f58"},
    ]
  },
  /* 2 ── Drop into cup */
  {
    title:"Level 2", objective:"Drop the ball into the cup",
    clue:"Draw a short platform to redirect the ball.",
    timeStar:14, shapesStar:1, shapesLimit:3, difficulty:"Easy",
    redZones:[],
    balls:[{x:20,y:12,r:18,color:"#e8a020"}],
    targets:[{x:75,y:80}],
    statics:[
      {type:"rect",x:50,y:52,w:32,h:8,angle:0.3,color:"#2a3f58"},
      {type:"rect",x:67,y:87,w:30,h:8,color:"#2a3f58"},
      {type:"rect",x:53,y:87,w:4,h:16,color:"#2a3f58"},
      {type:"rect",x:81,y:87,w:4,h:16,color:"#2a3f58"},
    ]
  },
  /* 3 ── Three balls funnel */
  {
    title:"Level 3", objective:"Get all 3 balls into the bucket",
    clue:"Build a funnel shape above the bucket.",
    timeStar:18, shapesStar:2, shapesLimit:4, difficulty:"Easy",
    redZones:[],
    balls:[
      {x:25,y:10,r:14,color:"#e8a020"},
      {x:40,y:10,r:14,color:"#e8a020"},
      {x:55,y:10,r:14,color:"#e8a020"},
    ],
    targets:[{x:50,y:80,multi:3}],
    statics:[
      {type:"rect",x:50,y:87,w:30,h:8,color:"#2a3f58"},
      {type:"rect",x:36,y:87,w:4,h:16,color:"#2a3f58"},
      {type:"rect",x:64,y:87,w:4,h:16,color:"#2a3f58"},
    ]
  },
  /* 4 ── Bridge the gap */
  {
    title:"Level 4", objective:"Bridge the gap to reach the bucket",
    clue:"Draw a plank from the high left platform DOWN to the right — the slope gives you speed.",
    timeStar:15, shapesStar:1, shapesLimit:3, difficulty:"Easy",
    redZones:[],
    balls:[{x:8,y:10,r:18,color:"#e8a020"}],
    targets:[{x:88,y:68}],
    statics:[
      {type:"rect",x:12,y:45,w:24,h:8,color:"#2a3f58"},
      {type:"rect",x:88,y:75,w:24,h:8,color:"#2a3f58"},
    ]
  },
  /* 5 ── Red zone */
  {
    title:"Level 5", objective:"Don't draw in the red zone!",
    clue:"Draw only on the left side — use an angled ramp to bounce the ball right.",
    timeStar:16, shapesStar:1, shapesLimit:3, difficulty:"Medium",
    redZones:[{x:50,y:0,w:50,h:100}],
    balls:[{x:18,y:15,r:18,color:"#e8a020"}],
    targets:[{x:68,y:80}],
    statics:[
      {type:"rect",x:60,y:87,w:28,h:8,color:"#2a3f58"},
      {type:"rect",x:46,y:87,w:4,h:16,color:"#2a3f58"},
      {type:"rect",x:74,y:87,w:4,h:16,color:"#2a3f58"},
    ]
  },
  /* 6 ── Seesaw — FIXED with proper pivot */
  {
    title:"Level 6", objective:"Tip the seesaw to launch the ball into the bucket",
    clue:"Draw a heavy Rectangle or Circle above the LEFT end of the seesaw, then Launch.",
    timeStar:22, shapesStar:2, shapesLimit:3, difficulty:"Medium",
    redZones:[],
    balls:[{x:74,y:58,r:16,color:"#e8a020"}],
    targets:[{x:16,y:80}],
    statics:[
      /* seesaw plank — isDynamic + isPivot pins its center */
      {type:"rect",x:50,y:66,w:50,h:8,color:"#3d7abf",isDynamic:true,isPivot:true},
      /* fulcrum */
      {type:"rect",x:50,y:78,w:7,h:18,color:"#2a3f58"},
      /* bucket left */
      {type:"rect",x:16,y:87,w:24,h:8,color:"#2a3f58"},
      {type:"rect",x:4, y:87,w:4,h:16,color:"#2a3f58"},
      {type:"rect",x:28,y:87,w:4,h:16,color:"#2a3f58"},
    ]
  },
  /* 7 ── REDESIGNED: zigzag corridor — ball must navigate two mid-air shelves */
  {
    title:"Level 7", objective:"Navigate the zigzag shelves into the bucket",
    clue:"Draw ramps that redirect the ball around each shelf.",
    timeStar:22, shapesStar:2, shapesLimit:4, difficulty:"Medium",
    redZones:[
      {x:0,  y:0, w:15,h:100},
      {x:85, y:0, w:15,h:100},
    ],
    balls:[{x:25,y:8,r:16,color:"#e8a020"}],
    targets:[{x:72,y:80}],
    statics:[
      /* left shelf blocks right path */
      {type:"rect",x:35,y:32,w:36,h:8,color:"#3d7abf"},
      /* right shelf blocks left path */
      {type:"rect",x:60,y:58,w:36,h:8,color:"#3d7abf"},
      /* bucket */
      {type:"rect",x:72,y:87,w:24,h:8,color:"#2a3f58"},
      {type:"rect",x:60,y:87,w:4,h:16,color:"#2a3f58"},
      {type:"rect",x:84,y:87,w:4,h:16,color:"#2a3f58"},
    ]
  },
  /* 8 ── FIXED domino chain — dominoes start on a raised platform so they
          don't fall at load; ball must knock the first one */
  {
    title:"Level 8", objective:"Knock the first domino to start the chain reaction",
    clue:"Draw a ramp to roll the ball into the first domino.",
    timeStar:28, shapesStar:1, shapesLimit:2, difficulty:"Medium",
    redZones:[],
    balls:[{x:8,y:10,r:15,color:"#e8a020"}],
    targets:[{x:88,y:75}],
    statics:[
      /* raised floor the dominoes stand on — prevents them tipping at load */
      {type:"rect",x:55,y:82,w:70,h:6,color:"#1a2d42"},
      /* domino tiles — sitting ON the raised floor (y=82 floor top ≈ py(79)) */
      {type:"rect",x:30,y:74,w:5,h:22,color:"#3d7abf",isDynamic:true},
      {type:"rect",x:42,y:74,w:5,h:22,color:"#3d7abf",isDynamic:true},
      {type:"rect",x:54,y:74,w:5,h:22,color:"#3d7abf",isDynamic:true},
      {type:"rect",x:66,y:74,w:5,h:22,color:"#3d7abf",isDynamic:true},
      {type:"rect",x:78,y:74,w:5,h:22,color:"#3d7abf",isDynamic:true},
      /* ball launch ramp */
      {type:"rect",x:8,y:42,w:20,h:7,color:"#2a3f58"},
      /* bucket */
      {type:"rect",x:88,y:82,w:20,h:7,color:"#2a3f58"},
      {type:"rect",x:78,y:82,w:4,h:14,color:"#2a3f58"},
      {type:"rect",x:98,y:82,w:4,h:14,color:"#2a3f58"},
    ]
  },
  /* 9 ── HARDER: two-stage ramp with a gap to cross */
  {
    title:"Level 9", objective:"Two-stage redirect — reach the hidden bucket",
    clue:"You need two ramps: one to catch the ball, one to redirect it left into the gap.",
    timeStar:25, shapesStar:2, shapesLimit:3, difficulty:"Hard",
    redZones:[
      {x:68,y:0,w:32,h:100},
      {x:0, y:0,w:12,h:100},
    ],
    balls:[{x:20,y:8,r:17,color:"#e8a020"}],
    targets:[{x:40,y:80}],
    statics:[
      /* mid platform forces a redirect */
      {type:"rect",x:55,y:40,w:22,h:7,angle:-0.3,color:"#3d7abf"},
      /* wall that forces ball to bounce left */
      {type:"rect",x:67,y:62,w:5,h:28,color:"#2a3f58"},
      /* bucket */
      {type:"rect",x:38,y:87,w:28,h:8,color:"#2a3f58"},
      {type:"rect",x:25,y:87,w:4,h:16,color:"#2a3f58"},
      {type:"rect",x:51,y:87,w:4,h:16,color:"#2a3f58"},
    ]
  },
  /* 10 ── Forbidden zone */
  {
    title:"Level 10", objective:"Cross the forbidden zone using only 2 shapes",
    clue:"A tall vertical plank just before the red zone can deflect the ball over it.",
    timeStar:20, shapesStar:2, shapesLimit:2, difficulty:"Hard",
    redZones:[{x:35,y:20,w:30,h:60}],
    balls:[{x:12,y:20,r:17,color:"#e8a020"}],
    targets:[{x:85,y:78}],
    statics:[
      {type:"rect",x:82,y:87,w:24,h:8,color:"#2a3f58"},
      {type:"rect",x:70,y:87,w:4,h:16,color:"#2a3f58"},
      {type:"rect",x:94,y:87,w:4,h:16,color:"#2a3f58"},
    ]
  },
  /* 11 ── HARDER elevated bucket with wall maze */
  {
    title:"Level 11", objective:"Thread the ball through the wall maze",
    clue:"Draw a ramp past the first wall, then another to guide it into the elevated bucket.",
    timeStar:28, shapesStar:2, shapesLimit:4, difficulty:"Hard",
    redZones:[
      {x:0, y:0,w:18,h:100},
      {x:82,y:0,w:18,h:100},
    ],
    balls:[{x:28,y:8,r:17,color:"#e8a020"}],
    targets:[{x:62,y:52}],
    statics:[
      /* blocking wall forces detour */
      {type:"rect",x:44,y:20,w:6,h:38,color:"#3d7abf"},
      /* elevated bucket platform */
      {type:"rect",x:62,y:60,w:22,h:7,color:"#2a3f58"},
      {type:"rect",x:51,y:60,w:4,h:18,color:"#2a3f58"},
      {type:"rect",x:73,y:60,w:4,h:18,color:"#2a3f58"},
      /* floor platform on left */
      {type:"rect",x:28,y:87,w:20,h:8,color:"#2a3f58"},
    ]
  },
  /* 12 ── Needle thread */
  {
    title:"Level 12", objective:"Thread the needle through the gaps",
    clue:"Use the narrow open strip — one precise plank is all you need.",
    timeStar:25, shapesStar:1, shapesLimit:2, difficulty:"Hard",
    redZones:[
      {x:0, y:0,w:22,h:100},
      {x:40,y:0,w:20,h:100},
      {x:75,y:0,w:25,h:100},
    ],
    balls:[{x:30,y:10,r:15,color:"#e8a020"}],
    targets:[{x:60,y:80}],
    statics:[
      {type:"rect",x:58,y:87,w:22,h:8,color:"#2a3f58"},
      {type:"rect",x:47,y:87,w:4,h:16,color:"#2a3f58"},
      {type:"rect",x:69,y:87,w:4,h:16,color:"#2a3f58"},
    ]
  },
  /* 13 ── Two balls two buckets */
  {
    title:"Level 13", objective:"Get 2 balls into their separate buckets",
    clue:"Split the balls apart with a wedge in the center.",
    timeStar:30, shapesStar:2, shapesLimit:4, difficulty:"Expert",
    redZones:[],
    balls:[
      {x:35,y:10,r:14,color:"#e8a020"},
      {x:65,y:10,r:14,color:"#1fb890"},
    ],
    targets:[
      {x:18,y:80},
      {x:82,y:80},
    ],
    statics:[
      {type:"rect",x:16,y:87,w:22,h:8,color:"#2a3f58"},
      {type:"rect",x:5, y:87,w:4,h:16,color:"#2a3f58"},
      {type:"rect",x:27,y:87,w:4,h:16,color:"#2a3f58"},
      {type:"rect",x:80,y:87,w:22,h:8,color:"#2a3f58"},
      {type:"rect",x:69,y:87,w:4,h:16,color:"#2a3f58"},
      {type:"rect",x:91,y:87,w:4,h:16,color:"#2a3f58"},
    ]
  },
  /* 14 ── HARDER labyrinth: more red zones, ball must bounce off 3 walls */
  {
    title:"Level 14", objective:"Escape the labyrinth — only 1 shape!",
    clue:"One perfectly placed plank can bounce the ball through all the gaps.",
    timeStar:40, shapesStar:1, shapesLimit:1, difficulty:"Expert",
    redZones:[
      {x:0,  y:0,  w:18, h:100},
      {x:82, y:0,  w:18, h:100},
      {x:18, y:0,  w:64, h:16},
      {x:18, y:35, w:50, h:14},
      {x:32, y:60, w:50, h:14},
      {x:18, y:82, w:30, h:18},
    ],
    balls:[{x:50,y:23,r:15,color:"#e8a020"}],
    targets:[{x:68,y:90}],
    statics:[
      {type:"rect",x:68,y:94,w:20,h:6,color:"#2a3f58"},
    ]
  },
  /* 15 ── Master challenge */
  {
    title:"Level 15", objective:"Master challenge — all elements combined",
    clue:"Build a cascading ramp system. Think 3 steps ahead.",
    timeStar:45, shapesStar:3, shapesLimit:5, difficulty:"Expert",
    redZones:[
      {x:55,y:0, w:20,h:70},
      {x:0, y:50,w:30,h:50},
    ],
    balls:[
      {x:15,y:10,r:16,color:"#e8a020"},
      {x:80,y:10,r:16,color:"#1fb890"},
    ],
    targets:[{x:40,y:83,multi:2}],
    statics:[
      {type:"rect",x:38,y:87,w:30,h:8,color:"#2a3f58"},
      {type:"rect",x:24,y:87,w:4,h:16,color:"#2a3f58"},
      {type:"rect",x:52,y:87,w:4,h:16,color:"#2a3f58"},
      {type:"rect",x:75,y:48,w:30,h:9,angle:0.35,color:"#3d7abf"},
      {type:"rect",x:42,y:60,w:26,h:9,angle:-0.25,color:"#3d7abf"},
    ],
  },
];
/* ─────────────────────────────────────────────────────────────
   GAME STATE
───────────────────────────────────────────────────────────── */
const State = {
  coins:          parseInt(localStorage.getItem('bio_coins')    || '0'),
  unlockedLevels: JSON.parse(localStorage.getItem('bio_unlocked')|| '[0]'),
  levelStars:     JSON.parse(localStorage.getItem('bio_stars')  || '{}'),
  currentLevel:   0,
  timer:          0,
  shapesDrawn:    0,
  paused:         false,
  goalReached:    false,
  launched:       false,
  timerInterval:  null,
  drawnBodies:    [],
  ballBodies:     [],
  currentTool:    'free',
  isDrawing:      false,
  drawStart:      {x:0,y:0},
  freePoints:     [],
  committedStrokes:[],

  save(){
    localStorage.setItem('bio_coins',    String(this.coins));
    localStorage.setItem('bio_unlocked', JSON.stringify(this.unlockedLevels));
    localStorage.setItem('bio_stars',    JSON.stringify(this.levelStars));
  },
  unlockLevel(idx){
    if(!this.unlockedLevels.includes(idx)){this.unlockedLevels.push(idx);this.save();}
  },
  isUnlocked(idx){ return this.unlockedLevels.includes(idx); },
  addCoins(n){ this.coins+=n; this.save(); updateCoinDisplays(); },
  setStars(levelIdx,stars){
    const k=String(levelIdx);
    if(!this.levelStars[k]||stars>this.levelStars[k]){this.levelStars[k]=stars;this.save();}
  },
  getStars(levelIdx){ return this.levelStars[String(levelIdx)]||0; }
};

/* ─────────────────────────────────────────────────────────────
   ENGINE REFS
───────────────────────────────────────────────────────────── */
let engine=null, mRender=null, runner=null, world=null;
let drawLoopToken=null;

const gameCanvas = ()=>document.getElementById('game-canvas');
const drawCanvas = ()=>document.getElementById('draw-canvas');

/* Invisible render — physics body exists but Matter renderer won't draw it */
const HIDDEN = { fillStyle:'rgba(0,0,0,0)', strokeStyle:'rgba(0,0,0,0)', opacity:0 };

const CAT_DEFAULT = 0x0001;
const CAT_DRAWN   = 0x0002;

/* ─────────────────────────────────────────────────────────────
   MAIN GAME OBJECT
───────────────────────────────────────────────────────────── */
const Game = {

  showScreen(name){
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    const el=document.getElementById('screen-'+name);
    if(el) el.classList.add('active');
    if(name==='level-select') this.buildLevelGrid();
    if(name==='menu')         updateCoinDisplays();
    if(name==='pause')
      document.getElementById('pause-level-name').textContent=LEVELS[State.currentLevel].title;
    Audio.click();
  },

  buildLevelGrid(){
    const grid=document.getElementById('level-grid');
    grid.innerHTML='';
    updateCoinDisplays();
    LEVELS.forEach((lv,i)=>{
      const unlocked=State.isUnlocked(i);
      const stars=State.getStars(i);
      const cell=document.createElement('div');
      cell.className='level-cell'+(unlocked?'':' locked')
        +(i===State.currentLevel?' current':'')
        +(lv.redZones&&lv.redZones.length?' has-red':'');
      const sh=[0,1,2].map(j=>`<span class="sm-star${stars>j?' earned':''}">★</span>`).join('');
      cell.innerHTML=unlocked
        ?`<div class="level-diff">${lv.difficulty}</div>
          <div class="level-num">${i+1}</div>
          <div class="level-stars-mini">${sh}</div>`
        :`<div class="level-lock">🔒</div>`;
      if(unlocked) cell.addEventListener('click',()=>this.startLevel(i));
      grid.appendChild(cell);
    });
  },

   /* ── Start / Restart ─────────────────────── */
  startLevel(idx){
    if(drawLoopToken){ cancelAnimationFrame(drawLoopToken); drawLoopToken=null; }
    this.stopTimer();
    Object.assign(State,{
      currentLevel:idx, timer:0, shapesDrawn:0,
      paused:false, goalReached:false, launched:false,
      drawnBodies:[], ballBodies:[], freePoints:[],
      isDrawing:false, committedStrokes:[]
    });
    const lv=LEVELS[idx];
    document.getElementById('hud-level-num').textContent   = idx+1;
    document.getElementById('hud-level-name').textContent  = lv.title;
    document.getElementById('hud-objective').textContent   = lv.objective;
    document.getElementById('hud-shapes').textContent      = '0';
    document.getElementById('hud-shape-limit').textContent = lv.shapesLimit;
    document.getElementById('hud-timer').textContent       = '0.0';
    document.getElementById('clue-display').classList.add('hidden');
    document.getElementById('clue-cost').textContent       = this.clueCost(idx);
    document.getElementById('timer-ring-fill').style.strokeDashoffset='0';
    document.getElementById('timer-ring-fill').style.stroke='#e8a020';
    this.showScreen('game');
    this.initPhysics();
    this.updateLaunchBtn();
  },

  /* ── Physics init ────────────────────────── */
  initPhysics(){
    if(runner)  { Runner.stop(runner);  runner=null;  }
    if(mRender) { Render.stop(mRender); mRender=null; }
    if(engine)  { World.clear(engine.world,false); Engine.clear(engine); engine=null; }

    const parent=document.getElementById('game-area');
    const W=parent.clientWidth||640, H=parent.clientHeight||480;

    const gc=gameCanvas();
    gc.width=W; gc.height=H;

    /* Fresh draw canvas — kills stale listeners */
    const oldDc=drawCanvas();
    const newDc=oldDc.cloneNode(false);
    newDc.id='draw-canvas'; newDc.width=W; newDc.height=H;
    oldDc.parentNode.replaceChild(newDc,oldDc);

    engine=Engine.create({gravity:{y:1.0}});
    world=engine.world;

    mRender=Render.create({
      canvas:gc, engine,
      options:{width:W,height:H,wireframes:false,background:'#141c27'}
    });

    const lv=LEVELS[State.currentLevel];
    const px=v=>v/100*W, py=v=>v/100*H;

    /* Boundaries */
    World.add(world,[
      Bodies.rectangle(W/2,H+30,W*2,60,{isStatic:true,render:{fillStyle:'#1a2332'}}),
      Bodies.rectangle(-30,H/2,60,H*2,{isStatic:true,render:{fillStyle:'#1a2332'}}),
      Bodies.rectangle(W+30,H/2,60,H*2,{isStatic:true,render:{fillStyle:'#1a2332'}}),
    ]);

    /* Level statics / dynamics */
    lv.statics.forEach(s=>{
      const isDyn=!!s.isDynamic;
      const opts={
        isStatic:!isDyn,
        angle:s.angle||0,
        friction:SURF_FRICTION,
        frictionStatic:SURF_FRICTION_STATIC,
        restitution:SURF_RESTITUTION,
        render:{fillStyle:s.color||'#2a3f58'},
        label:s.label||'static',
        collisionFilter:{category:CAT_DEFAULT, mask:CAT_DEFAULT|CAT_DRAWN}
      };
      let b;
      if(s.type==='rect')   b=Bodies.rectangle(px(s.x),py(s.y),px(s.w),py(s.h),opts);
      if(s.type==='circle') b=Bodies.circle(px(s.x),py(s.y),px(s.r||5),opts);
      if(!b) return;
      World.add(world,b);
      /* Pin pivot seesaws at their centre */
      if(s.isPivot && isDyn){
        World.add(world, Constraint.create({
          pointA:{x:px(s.x),y:py(s.y)},
          bodyB:b, pointB:{x:0,y:0},
          stiffness:1, length:0,
          render:{strokeStyle:'#4a6fa5',lineWidth:3}
        }));
      }
    });

    Events.on(engine,'afterUpdate',()=>this.checkWin());

    Events.on(engine, 'collisionStart', event => {
  const now = Date.now();
  if(now - (Audio._lastBounce || 0) < 80) return; // 80ms cooldown
  const pairs = event.pairs;
  for(let i = 0; i < pairs.length; i++){
    const {bodyA, bodyB} = pairs[i];
    const isBall = bodyA.label.startsWith('ball_') || bodyB.label.startsWith('ball_');
    if(isBall){
      /* Scale volume by impact speed — soft touches are quieter */
      const vel = bodyA.label.startsWith('ball_') ? bodyA.speed : bodyB.speed;
      const vol = Math.min(0.9, Math.max(0.1, vel / 18));
      Audio.play('sfx-bounce', vol);
      Audio._lastBounce = now;
      break;
    }
  }
});

    runner=Runner.create();
    Runner.run(runner,engine);
    Render.run(mRender);

    this.drawRedZones();
    this.setupDrawCanvas();
  },

    /* ── Red zones ───────────────────────────── */
  drawRedZones(){
    const overlay=document.getElementById('red-zones-overlay');
    overlay.innerHTML='';
    LEVELS[State.currentLevel].redZones.forEach(rz=>{
      const div=document.createElement('div');
      div.style.cssText=`position:absolute;left:${rz.x}%;top:${rz.y}%;width:${rz.w}%;height:${rz.h}%;`
        +`background:rgba(192,57,43,0.15);border:1.5px solid rgba(192,57,43,0.5);pointer-events:none;`;
      const lbl=document.createElement('div');
      lbl.textContent='NO DRAW';
      lbl.style.cssText=`position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);`
        +`font-size:11px;font-weight:900;letter-spacing:0.1em;color:rgba(192,57,43,0.55);`
        +`font-family:'Orbitron',monospace;white-space:nowrap;pointer-events:none;`;
      div.appendChild(lbl);
      overlay.appendChild(div);
    });
  },

  isInRedZone(xPct,yPct){
    return LEVELS[State.currentLevel].redZones.some(
      rz=>xPct>=rz.x&&xPct<=rz.x+rz.w&&yPct>=rz.y&&yPct<=rz.y+rz.h
    );
  },

  /* ── Draw canvas ─────────────────────────── */
  setupDrawCanvas(){
    const dc=drawCanvas();
    dc.addEventListener('mousedown', e=>this.onDrawStart(e));
    dc.addEventListener('mousemove', e=>this.onDrawMove(e));
    dc.addEventListener('mouseup',   e=>this.onDrawEnd(e));
    dc.addEventListener('mouseleave',e=>{ if(State.isDrawing) this.onDrawEnd(e); });
    dc.addEventListener('touchstart',e=>{e.preventDefault();this.onDrawStart(e.touches[0]);},{passive:false});
    dc.addEventListener('touchmove', e=>{e.preventDefault();this.onDrawMove(e.touches[0]);},{passive:false});
    dc.addEventListener('touchend',  e=>{e.preventDefault();this.onDrawEnd(e.changedTouches[0]);},{passive:false});
    this.startDrawLoop();
  },

  getCanvasPos(e){
    const dc=drawCanvas(), r=dc.getBoundingClientRect();
    return {
      x:(e.clientX-r.left)*(dc.width/r.width),
      y:(e.clientY-r.top)*(dc.height/r.height),
      xPct:((e.clientX-r.left)/r.width)*100,
      yPct:((e.clientY-r.top)/r.height)*100,
    };
  },

  onDrawStart(e){
    if(State.paused||State.goalReached||State.launched) return;
    if(State.shapesDrawn>=LEVELS[State.currentLevel].shapesLimit){
      this.showToast('Shape limit reached! Undo or Launch.'); return;
    }
    const pos=this.getCanvasPos(e);
    if(this.isInRedZone(pos.xPct,pos.yPct)){
      this.showToast('Cannot draw in red zone!'); return;
    }
    State.isDrawing=true;
    State.drawStart=pos;
    State.freePoints=[pos];
  },

  onDrawMove(e){
    if(!State.isDrawing) return;
    const pos=this.getCanvasPos(e);
    if(this.isInRedZone(pos.xPct,pos.yPct)){
      State.isDrawing=false; State.freePoints=[];
      this.showToast('Cannot draw in red zone!'); return;
    }
    State.freePoints.push(pos);
  },

  onDrawEnd(e){
    if(!State.isDrawing) return;
    State.isDrawing=false;
    const pts=State.freePoints;
    if(!pts||pts.length<2){ State.freePoints=[]; return; }
    if(pts.some(p=>this.isInRedZone(p.xPct,p.yPct))){
      State.freePoints=[]; this.showToast('Shape cancelled — crossed a red zone!'); return;
    }

    const sx=State.drawStart.x, sy=State.drawStart.y;
    const ep=pts[pts.length-1];
    const ex=ep.x, ey=ep.y;
    let committed=false;

    /* ── WEIGHT tools (rect / circle) ──
       Frozen as static until Launch, then unfrozen.
       All have identical surface props so no speed penalty. */
    if(State.currentTool==='rect'){
      const w=Math.abs(ex-sx), h=Math.abs(ey-sy);
      if(w>15&&h>15){
        const area=w*h;
        const density=Math.min(0.012,Math.max(0.003,area/60000));
        const body=Bodies.rectangle(
          sx+(ex-sx)/2, sy+(ey-sy)/2, Math.max(w,15), Math.max(h,15),
          { isStatic:true, density,
            friction:WEIGHT_FRICTION, frictionStatic:WEIGHT_FRICTION_STATIC,
            restitution:WEIGHT_RESTITUTION,
            collisionFilter:{category:CAT_DRAWN,mask:CAT_DEFAULT|CAT_DRAWN},
            render:HIDDEN, label:'drawn_dynamic' }
        );
        World.add(world,body);
        State.drawnBodies.push({isGroup:false,body});
        State.committedStrokes.push({type:'rect',sx,sy,ex,ey});
        committed=true;
      }

    } else if(State.currentTool==='circle'){
      const rad=Math.min(120,Math.max(12,Math.hypot(ex-sx,ey-sy)));
      const density=Math.min(0.012,Math.max(0.003,(rad*rad)/20000));
      const body=Bodies.circle(sx,sy,rad,
        { isStatic:true, density,
          friction:WEIGHT_FRICTION, frictionStatic:WEIGHT_FRICTION_STATIC,
          restitution:WEIGHT_RESTITUTION,
          collisionFilter:{category:CAT_DRAWN,mask:CAT_DEFAULT|CAT_DRAWN},
          render:HIDDEN, label:'drawn_dynamic' }
      );
      World.add(world,body);
      State.drawnBodies.push({isGroup:false,body});
      State.committedStrokes.push({type:'circle',sx,sy,rad});
      committed=true;

    /* ── RAMP tools (plank / freehand) ──
       Static forever. Friction IDENTICAL to freehand segments
       so the ball never changes speed when crossing tool boundaries. */
    } else if(State.currentTool==='line'){
      const cx=(sx+ex)/2, cy=(sy+ey)/2;
      const len=Math.max(30,Math.hypot(ex-sx,ey-sy));
      const angle=Math.atan2(ey-sy,ex-sx);
      const body=Bodies.rectangle(cx,cy,len,14,
        { angle, isStatic:true,
          friction:SURF_FRICTION, frictionStatic:SURF_FRICTION_STATIC,
          restitution:SURF_RESTITUTION,
          collisionFilter:{category:CAT_DRAWN,mask:CAT_DEFAULT|CAT_DRAWN},
          render:HIDDEN, label:'drawn' }
      );
      World.add(world,body);
      State.drawnBodies.push({isGroup:false,body});
      State.committedStrokes.push({type:'line',sx,sy,ex,ey});
      committed=true;

    } else if(State.currentTool==='free'){
      const step=Math.max(1,Math.floor(pts.length/40));
      const simplified=pts.filter((_,i)=>i%step===0||i===pts.length-1);
      if(simplified.length>=2){
        const segBodies=[];
        for(let i=0;i<simplified.length-1;i++){
          const a=simplified[i], b2=simplified[i+1];
          const segLen=Math.hypot(b2.x-a.x,b2.y-a.y);
          if(segLen<4) continue;
          segBodies.push(Bodies.rectangle(
            (a.x+b2.x)/2,(a.y+b2.y)/2, segLen, 12,
            { angle:Math.atan2(b2.y-a.y,b2.x-a.x), isStatic:true,
              friction:SURF_FRICTION, frictionStatic:SURF_FRICTION_STATIC,
              restitution:SURF_RESTITUTION,
              collisionFilter:{category:CAT_DRAWN,mask:CAT_DEFAULT|CAT_DRAWN},
              render:HIDDEN, label:'drawn_seg' }
          ));
        }
        if(segBodies.length){
          segBodies.forEach(b=>World.add(world,b));
          State.drawnBodies.push({isGroup:true,bodies:segBodies});
          State.committedStrokes.push({type:'free',pts:[...pts]});
          committed=true;
        }
      }
    }

    if(committed){
      State.shapesDrawn++;
      document.getElementById('hud-shapes').textContent=State.shapesDrawn;
      this.updateLaunchBtn();
    }
    State.freePoints=[];
  },

  /* ── Draw loop ───────────────────────────── */
  startDrawLoop(){
    if(drawLoopToken){ cancelAnimationFrame(drawLoopToken); drawLoopToken=null; }
    const tick=()=>{ this.renderDrawCanvas(); drawLoopToken=requestAnimationFrame(tick); };
    drawLoopToken=requestAnimationFrame(tick);
  },

  renderDrawCanvas(){
    const dc=drawCanvas(); if(!dc) return;
    const ctx=dc.getContext('2d');
    const W=dc.width, H=dc.height;
    ctx.clearRect(0,0,W,H);
    const px=v=>v/100*W, py=v=>v/100*H;
    const lv=LEVELS[State.currentLevel];

    /* Target rings */
    lv.targets.forEach(t=>{
      ctx.save();
      ctx.beginPath(); ctx.arc(px(t.x),py(t.y),34,0,Math.PI*2);
      ctx.fillStyle='rgba(31,184,144,0.12)'; ctx.strokeStyle='#1fb890'; ctx.lineWidth=2.5;
      ctx.fill(); ctx.stroke();
      ctx.fillStyle='#1fb890'; ctx.font='700 11px Nunito,sans-serif';
      ctx.textAlign='center'; ctx.fillText('TARGET',px(t.x),py(t.y)+4);
      ctx.restore();
    });

    /* Ghost balls before launch */
    if(!State.launched){
      lv.balls.forEach(bd=>{
        ctx.save();
        ctx.beginPath(); ctx.arc(px(bd.x),py(bd.y),bd.r,0,Math.PI*2);
        ctx.fillStyle=bd.color+'44'; ctx.strokeStyle=bd.color; ctx.lineWidth=2;
        ctx.setLineDash([4,4]); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
        ctx.restore();
      });
      /* Banner */
      ctx.save();
      const bw=Math.min(W*0.78,500), bh=28, bx=(W-bw)/2, by=8;
      ctx.fillStyle='rgba(14,22,34,0.82)';
      ctx.beginPath();
      if(ctx.roundRect) ctx.roundRect(bx,by,bw,bh,7); else ctx.rect(bx,by,bw,bh);
      ctx.fill();
      ctx.fillStyle='#e8a020'; ctx.font='700 11px Nunito,sans-serif'; ctx.textAlign='center';
      const isWeight=(State.currentTool==='rect'||State.currentTool==='circle');
      ctx.fillText(
        isWeight
          ? '⚖ WEIGHT — shape falls on Launch  ·  size = mass'
          : '✏ RAMP — shape stays fixed  ·  switch to Rect/Circle for weights',
        W/2, by+18
      );
      ctx.restore();
    }

    /* Committed strokes */
    State.committedStrokes.forEach(s=>{
      ctx.save();
      ctx.lineCap='round'; ctx.lineJoin='round'; ctx.setLineDash([]);

      if(s.type==='free'){
        ctx.strokeStyle='#4a6fa5'; ctx.lineWidth=12;
        ctx.beginPath();
        s.pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));
        ctx.stroke();
        ctx.strokeStyle='rgba(120,170,230,0.3)'; ctx.lineWidth=4;
        ctx.beginPath();
        s.pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));
        ctx.stroke();

      } else if(s.type==='line'){
        const dx=s.ex-s.sx, dy=s.ey-s.sy;
        const len=Math.hypot(dx,dy), angle=Math.atan2(dy,dx);
        ctx.translate((s.sx+s.ex)/2,(s.sy+s.ey)/2); ctx.rotate(angle);
        ctx.fillStyle='#d4943a';
        ctx.beginPath(); ctx.roundRect(-len/2,-7,len,14,4); ctx.fill();
        ctx.strokeStyle='rgba(255,200,100,0.25)'; ctx.lineWidth=1.5; ctx.stroke();

      } else if(s.type==='rect'){
        const rx=Math.min(s.sx,s.ex), ry=Math.min(s.sy,s.ey);
        const rw=Math.abs(s.ex-s.sx), rh=Math.abs(s.ey-s.sy);
        const heaviness=rw*rh>20000?'Heavy':rw*rh>8000?'Medium':'Light';
        ctx.fillStyle=State.launched?'rgba(200,100,30,0.6)':'rgba(200,100,30,0.42)';
        ctx.strokeStyle='#d4693a'; ctx.lineWidth=2.5;
        ctx.beginPath(); ctx.roundRect(rx,ry,rw,rh,4); ctx.fill(); ctx.stroke();
        ctx.fillStyle='rgba(255,185,110,0.92)'; ctx.font='bold 11px Nunito,sans-serif';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(State.launched?`⚖ ${heaviness}`:`⚖ ${heaviness} · drops on launch`, rx+rw/2, ry+rh/2);

      } else if(s.type==='circle'){
        const area=Math.PI*s.rad*s.rad;
        const heaviness=area>15000?'Heavy':area>5000?'Medium':'Light';
        ctx.fillStyle=State.launched?'rgba(200,100,30,0.5)':'rgba(200,100,30,0.35)';
        ctx.strokeStyle='#d4693a'; ctx.lineWidth=2.5;
        ctx.beginPath(); ctx.arc(s.sx,s.sy,s.rad,0,Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.fillStyle='rgba(255,185,110,0.92)'; ctx.font='bold 11px Nunito,sans-serif';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(`⚖ ${heaviness}`, s.sx, s.sy);
      }
      ctx.restore();
    });

    /* Live preview */
    if(State.isDrawing&&State.freePoints.length>1){
      const pts=State.freePoints;
      ctx.save();
      ctx.strokeStyle='rgba(232,160,32,0.9)';
      ctx.lineWidth=State.currentTool==='line'?14:8;
      ctx.lineCap='round'; ctx.lineJoin='round'; ctx.setLineDash([]);
      if(State.currentTool==='free'){
        ctx.beginPath();
        pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));
        ctx.stroke();
      } else if(State.currentTool==='rect'){
        const s=pts[0],e=pts[pts.length-1];
        ctx.fillStyle='rgba(232,160,32,0.08)';
        ctx.strokeRect(s.x,s.y,e.x-s.x,e.y-s.y);
        ctx.fillRect(s.x,s.y,e.x-s.x,e.y-s.y);
      } else if(State.currentTool==='circle'){
        const s=pts[0],e=pts[pts.length-1];
        ctx.fillStyle='rgba(232,160,32,0.08)';
        ctx.beginPath(); ctx.arc(s.x,s.y,Math.hypot(e.x-s.x,e.y-s.y),0,Math.PI*2);
        ctx.fill(); ctx.stroke();
      } else if(State.currentTool==='line'){
        const s=pts[0],e=pts[pts.length-1];
        ctx.beginPath(); ctx.moveTo(s.x,s.y); ctx.lineTo(e.x,e.y); ctx.stroke();
      }
      ctx.restore();
    }
  },

  /* ── Launch button ───────────────────────── */
  updateLaunchBtn(){
    let btn=document.getElementById('btn-launch');
    if(!btn){
      btn=document.createElement('button');
      btn.id='btn-launch'; btn.className='hud-btn launch-btn';
      btn.style.cssText='background:#1fb890;color:#041a12;border-color:#1fb890;font-weight:800;';
      btn.onclick=()=>Game.launch();
      document.getElementById('game-hud').appendChild(btn);
    }
    if(State.launched){
      btn.textContent='🚀 Launched'; btn.disabled=true; btn.style.opacity='0.45';
    } else {
      btn.textContent='🚀 Launch!'; btn.disabled=false; btn.style.opacity='1';
    }
  },

  launch(){
    if(State.launched||State.goalReached) return;
    State.launched=true;
    Audio.launch();
    this.updateLaunchBtn();

    const lv=LEVELS[State.currentLevel];
    const W=gameCanvas().width, H=gameCanvas().height;
    const px=v=>v/100*W, py=v=>v/100*H;

    /* Unfreeze weight bodies — Body.setStatic(false) restores mass from
       density that was stored at creation, no override needed */
    State.drawnBodies.forEach(entry=>{
      (entry.isGroup?entry.bodies:[entry.body]).forEach(b=>{
        if(b.label==='drawn_dynamic') Body.setStatic(b,false);
      });
    });

    /* Spawn balls */
    lv.balls.forEach((bd,bi)=>{
      const ball=Bodies.circle(px(bd.x),py(bd.y),bd.r,{
        restitution:BALL_RESTITUTION,
        friction:BALL_FRICTION,
        frictionStatic:BALL_FRICTION_STATIC,
        frictionAir:BALL_FRICTION_AIR,
        density:BALL_DENSITY,
        render:{fillStyle:bd.color||'#e8a020'},
        label:'ball_'+bi,
        collisionFilter:{category:CAT_DEFAULT,mask:CAT_DEFAULT|CAT_DRAWN}
      });
      State.ballBodies.push(ball);
      World.add(world,ball);
    });

    this.startTimer();
  },

  /* ── Win detection ───────────────────────── */
  checkWin(){
    if(State.goalReached||State.paused||!State.launched||!State.ballBodies.length) return;
    const lv=LEVELS[State.currentLevel];
    const W=gameCanvas().width, H=gameCanvas().height;
    const px=v=>v/100*W, py=v=>v/100*H;
    const allIn=lv.targets.every(t=>{
      const tx=px(t.x),ty=py(t.y),needed=t.multi||1;
      let count=0;
      State.ballBodies.forEach(b=>{
        if(Math.hypot(b.position.x-tx,b.position.y-ty)<55) count++;
      });
      return count>=needed;
    });
    if(allIn) this.triggerWin();
  },

  triggerWin(){
    State.goalReached=true; 
    Audio.win();
    this.stopTimer(); 
    this.showGoalCountdown(3);
  },

  showGoalCountdown(n){
    document.getElementById('goal-countdown').textContent=n;
    this.showScreen('goal');
    if(n>0) setTimeout(()=>this.showGoalCountdown(n-1),1000);
    else    this.showLevelComplete();
  },

  showLevelComplete(){
    const lv=LEVELS[State.currentLevel];
    const idx=State.currentLevel;
    const t=State.timer, sh=State.shapesDrawn;
    let stars=1;
    if(t<=lv.timeStar)    stars=Math.max(stars,2);
    if(sh<=lv.shapesStar) stars=Math.max(stars,2);
    if(t<=lv.timeStar&&sh<=lv.shapesStar) stars=3;
    State.setStars(idx,stars);
    const coinReward=stars*3;
    State.addCoins(coinReward);
    if(idx+1<LEVELS.length) State.unlockLevel(idx+1);
    document.getElementById('complete-level-name').textContent=lv.title;
    document.getElementById('c-time').textContent            =t.toFixed(1)+'s';
    document.getElementById('c-shapes').textContent         =sh+(sh===1?' shape':' shapes');
    document.getElementById('c-goal-time').textContent      =lv.timeStar+'s';
    document.getElementById('c-goal-shapes').textContent    =lv.shapesStar+(lv.shapesStar===1?' shape':' shapes');
    document.getElementById('complete-coin-reward').textContent='+'+coinReward;
    document.getElementById('star2-time').textContent       =t.toFixed(1)+'s';
    document.getElementById('star3-shapes').textContent     =sh+' shape'+(sh===1?'':'s');
    [1,2,3].forEach((n,i)=>{
      const wrap=document.getElementById('star'+n);
      wrap.classList.remove('earned');
      if(n<=stars) setTimeout(()=>wrap.classList.add('earned'),200+i*200);
    });
    this.showScreen('complete');
    updateCoinDisplays();
  },

  /* ── Timer ───────────────────────────────── */
  startTimer(){
    this.stopTimer();
    const lv=LEVELS[State.currentLevel];
    const ringEl=document.getElementById('timer-ring-fill');
    State.timerInterval=setInterval(()=>{
      if(!State.paused&&!State.goalReached){
        State.timer+=0.1;
        document.getElementById('hud-timer').textContent=State.timer.toFixed(1);
        const prog=Math.min(1,State.timer/(lv.timeStar*1.5));
        ringEl.style.strokeDashoffset=113*prog;
        ringEl.style.stroke=prog<0.6?'#e8a020':prog<0.85?'#d4943a':'#c0392b';
      }
    },100);
  },
  stopTimer(){ if(State.timerInterval){clearInterval(State.timerInterval);State.timerInterval=null;} },

  togglePause(){
    State.paused=!State.paused;
    this.showScreen(State.paused?'pause':'game');
  },

  restartLevel(){ this.startLevel(State.currentLevel); },

  nextLevel(){
    const next=State.currentLevel+1;
    if(next<LEVELS.length&&State.isUnlocked(next)) this.startLevel(next);
    else this.showScreen('level-select');
  },

  undoLast(){
    if(!world||!State.drawnBodies.length) return;
    const entry=State.drawnBodies.pop();
    if(entry.isGroup) entry.bodies.forEach(b=>World.remove(world,b));
    else              World.remove(world,entry.body);
    State.committedStrokes.pop();
    State.shapesDrawn=Math.max(0,State.shapesDrawn-1);
    document.getElementById('hud-shapes').textContent=State.shapesDrawn;
    this.updateLaunchBtn();
  },

  clearDrawn(){
    if(!world) return;
    State.drawnBodies.forEach(entry=>{
      if(entry.isGroup) entry.bodies.forEach(b=>World.remove(world,b));
      else              World.remove(world,entry.body);
    });
    State.drawnBodies=[]; State.committedStrokes=[];
    State.shapesDrawn=0;
    document.getElementById('hud-shapes').textContent=0;
    this.updateLaunchBtn();
  },

  setTool(t){
    State.currentTool=t;
    document.querySelectorAll('.tool-btn[id^="tool-"]').forEach(b=>b.classList.remove('active'));
    const btn=document.getElementById('tool-'+t);
    if(btn) btn.classList.add('active');
  },

  clueCost(idx){ return Math.max(5,Math.floor(idx/3)*5+5); },

  useClue(){
    const idx=State.currentLevel, cost=this.clueCost(idx);
    if(State.coins<cost){ this.showToast(`Need ${cost} coins. You have ${State.coins}.`); return; }
    State.addCoins(-cost);
    const el=document.getElementById('clue-display');
    el.textContent='💡 '+LEVELS[idx].clue;
    el.classList.remove('hidden');
    setTimeout(()=>el.classList.add('hidden'),6000);
    updateCoinDisplays();
  },

  showToast(msg){
    let t=document.getElementById('toast');
    if(!t){
      t=document.createElement('div'); t.id='toast';
      t.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);'
        +'background:#1e2d40;border:1px solid #2e4057;color:#8aa0b8;'
        +'font-size:13px;font-weight:700;padding:10px 18px;border-radius:10px;'
        +'z-index:999;pointer-events:none;font-family:Nunito,sans-serif;transition:opacity 0.3s;';
      document.body.appendChild(t);
    }
    t.textContent=msg; t.style.opacity='1';
    clearTimeout(t._t);
    t._t=setTimeout(()=>{t.style.opacity='0';},2500);
  }
};

/* ─────────────────────────────────────────────────────────────
   HELPERS + INIT
───────────────────────────────────────────────────────────── */
function updateCoinDisplays(){
  ['menu-coin-count','ls-coin-count','hud-coins'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.textContent=State.coins;
  });
}

window.addEventListener('load',()=>{
  State.unlockLevel(0);
  updateCoinDisplays();
  Game.showScreen('menu');

  /* Sync muted states with saved prefs */
  if(!Audio.musicOn) document.getElementById('btn-music')?.classList.add('muted');
  if(!Audio.sfxOn)   document.getElementById('btn-sfx')?.classList.add('muted');

  /* Start music on first click anywhere (bypasses autoplay policy) */
  document.body.addEventListener('click', ()=>Audio.init(), { once:true });

  window.addEventListener('resize',()=>{
    if(document.getElementById('screen-game').classList.contains('active')&&engine){
      Game.startLevel(State.currentLevel);
    }
  });
});

window.Game=Game;