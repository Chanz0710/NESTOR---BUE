'use strict';

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