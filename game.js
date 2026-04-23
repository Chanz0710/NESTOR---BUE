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