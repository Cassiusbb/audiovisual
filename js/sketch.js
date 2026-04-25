let angle = 0;
let robot;
let sound, fft;
let loaded = false;
let bgStars = [];
let outlineColor = 'green'; // 'green' or 'red'
let outlineBtn;

function preload() {
  robot = loadModel('robot.obj', true, handleModel, handleError);
}

function setup() {
  createCanvas(1000, 1000, WEBGL);

  fft = new p5.FFT(0.85, 1024);

  // Create a file input button on the page
  let btn = createFileInput(handleFile);
  btn.position(20, 20);
  btn.attribute('accept', 'audio/*');

  // Play/pause button
  let playBtn = createButton('Play / Pause');
  playBtn.position(160, 20);
  playBtn.mousePressed(togglePlay);

  // Outline color toggle button
  outlineBtn = createButton('Outline: Green');
  outlineBtn.position(270, 20);
  outlineBtn.mousePressed(toggleOutlineColor);

  //background stars/particles
  for (let i = 0; i < 200; i++) {
    bgStars.push({
      x: random(-width, width),
      y: random(-height, height),
      z: random(-800, -200),
      baseSize: random(2, 7),
      hue: random(360)
    });
  }



  colorMode(RGB, 255);
}

function handleFile(file) {
  if (file.type === 'audio') {
    if (sound) {
      sound.stop();
      sound.disconnect();
    }
    sound = loadSound(file.data, () => {
      loaded = true;
      fft.setInput(sound);
      sound.loop();
    });
  } else {
    console.warn('Please load an audio file.');
  }
}

function togglePlay() {
  if (!sound || !loaded) return;
  if (sound.isPlaying()) {
    sound.pause();
  } else {
    sound.loop();
  }
}

function toggleOutlineColor() {
  outlineColor = (outlineColor === 'green') ? 'red' : 'green';
  outlineBtn.html('Outline: ' + (outlineColor === 'green' ? 'Green' : 'Red'));
}

function draw() {
  let bassN   = 0;
  let midN    = 0;
  let trebleN = 0;
  let level   = 0;

  if (loaded && sound.isPlaying()) {
    fft.analyze();
    bassN   = fft.getEnergy('bass')    / 255;
    midN    = fft.getEnergy('mid')     / 255;
    trebleN = fft.getEnergy('treble')  / 255;
    level   = (bassN + midN + trebleN) / 3;
  }

  let isRed = (outlineColor === 'red');

  // ---------- REACTIVE BACKGROUND ----------
  if (isRed) {
    // Hot red / crimson theme
    let bgR = map(bassN,   0, 1, 40, 200);
    let bgG = map(midN,    0, 1,  5,  30);
    let bgB = map(trebleN, 0, 1,  5,  40);
    background(bgR, bgG, bgB);
  } else {
    let bgR = map(bassN,   0, 1, 10, 120);
    let bgG = map(midN,    0, 1, 10,  60);
    let bgB = map(trebleN, 0, 1, 25, 180);
    background(bgR, bgG, bgB);
  }

  //pulsing "glow" behind everything
  push();
  translate(0, 0, -900);
  noStroke();
  let glowSize = map(level, 0, 1, 1200, 2400);
  for (let i = 6; i > 0; i--) {
    if (isRed) {
      fill(
        map(bassN,   0, 1, 180, 255),
        map(midN,    0, 1,  30, 120),
        map(trebleN, 0, 1,  20,  90),
        20 + i * 6
      );
    } else {
      fill(
        map(trebleN, 0, 1, 80, 255),
        map(midN,    0, 1, 40, 180),
        map(bassN,   0, 1, 120, 255),
        20 + i * 6
      );
    }
    ellipse(0, 0, glowSize * (i / 6), glowSize * (i / 6));
  }
  pop();

  // Star/particle field reacting to treble
  push();
  noStroke();
  for (let s of bgStars) {
    let tw = 0.5 + trebleN * 2.5;
    let sz = s.baseSize * tw;
    push();
    translate(s.x, s.y, s.z);
    if (isRed) {
      fill(
        255,
        80 + midN * 100,
        80 + trebleN * 60,
        150 + bassN * 105
      );
    } else {
      fill(
        200 + trebleN * 55,
        180 + midN * 75,
        255,
        150 + bassN * 105
      );
    }
    sphere(sz, 6, 6);
    pop();
    s.x += sin(frameCount * 0.005 + s.hue) * 0.3;
    s.y += cos(frameCount * 0.005 + s.hue) * 0.3;
  }
  pop();

  orbitControl();

  // ---------- LIGHTS ----------
  ambientLight(map(bassN, 0, 1, 30, 90));

  if (isRed) {
    // Warm key light — red to orange with treble
    let rR = map(trebleN, 0, 1, 200, 255);
    let rG = map(trebleN, 0, 1,  40, 140);
    directionalLight(rR, rG, 40, 0, -1, -1);
  } else {
    let r = map(trebleN, 0, 1, 120, 255);
    let b = map(trebleN, 0, 1, 255, 120);
    directionalLight(r, 140, b, 0, -1, -1);
  }

  // Rotating colored point lights
  let t = frameCount * 0.02;
  let orbitR = 400;
  if (isRed) {
    pointLight(
      255, 60 + midN * 120, 40,
      cos(t) * orbitR, sin(t) * orbitR * 0.5, 300
    );
    pointLight(
      255, 120 + trebleN * 80, 60,
      cos(t + PI) * orbitR, sin(t + PI) * orbitR * 0.5, 300
    );
  } else {
    pointLight(
      255, 80 + midN * 175, 200,
      cos(t) * orbitR, sin(t) * orbitR * 0.5, 300
    );
    pointLight(
      80 + trebleN * 175, 200, 255,
      cos(t + PI) * orbitR, sin(t + PI) * orbitR * 0.5, 300
    );
  }
  pointLight(
    255, 255, 255,
    0, -400, 200
  );

  // ---------- ROBOT ----------
  push();

  // Spin speed driven by treble
  let spinSpeed = map(trebleN, 0, 1, 0.01, 0.12);
  angle += spinSpeed + 0.01;

  rotateX(angle * 0.4);
  rotateY(angle);

  // Scale pulse on bass — base size doubled
  let scaleFactor = map(bassN, 0, 1, 1.6, 3.6);
  scale(scaleFactor);

  // Shake on strong bass hit
  if (bassN > 0.75) {
    translate(random(-6, 6), random(-6, 6), 0);
  }

  // ambientMaterial defines base tint under ambient light
  ambientMaterial(60, 70, 90);
  // specularMaterial drives the glossy highlight color
  specularMaterial(255, 255, 255);
  // High shininess = tight, sharp reflections
  shininess(map(trebleN, 0, 1, 60, 200));

  // Neon outline on the robot — edges get brighter/thicker with the beat
  if (outlineColor === 'green') {
    stroke(0, 255, 120, 220);
  } else {
    stroke(255, 40, 60, 220);
  }
  strokeWeight(map(bassN, 0, 1, 1.2, 3.5));

  model(robot);
  pop();

 

  // ---------- FFT RINGS (all around) ----------
  let spectrum = fft.analyze();
  push();
  noFill();
  strokeWeight(20);

  // Ring 1 —  (front-facing)
  if (isRed) {
    stroke(255, 60, 80, 200);
  } else {
    stroke(255, 80, 220, 180);
  }
  beginShape();
  for (let i = 0; i < spectrum.length; i += 30) {
    let a = map(i, 0, spectrum.length, 0, TWO_PI);
    let r2 = map(spectrum[i], 0, 255, 440, 820);
    vertex(r2 * cos(a), r2 * sin(a), 0);
  }
  endShape(CLOSE);

  // Ring 2 —  diagonal ring 
  push();
  rotateY(frameCount * 0.008);
  rotateX(frameCount * 0.005);
  if (isRed) {
    stroke(255, 160, 60, 200);
  } else {
    stroke(255, 220, 120, 180);
  }
  beginShape();
  for (let i = 0; i < spectrum.length; i += 30) {
    let a = map(i, 0, spectrum.length, 0, TWO_PI);
    let r2 = map(spectrum[i], 0, 255, 460, 840);
    vertex(r2 * cos(a), r2 * sin(a), 0);
  }
  endShape(CLOSE);
  pop();

  pop();
}

function handleError(error) {
  console.error('Model load error:', error);
}

function handleModel(data) {
  robot = data;
  console.log('Robot model loaded');
}
