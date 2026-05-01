// ===== GLOBAL VARIABLES =====
let angle = 0;            // Cumulative rotation angle for the robot (grows each frame)
let robot;                // The 3D model object loaded from robot.obj
let sound, fft;           // The user's audio file + the FFT analyzer that reads its frequencies
let loaded = false;       // Becomes true once the audio file has finished loading
let bgStars = [];         // Array of background "star" particles 
let outlineColor = 'green'; // Current robot-outline theme
let outlineBtn;          

// ===== preload() =====
// p5.js calls this BEFORE setup(). It's the place to load assets that must
// be ready before drawing starts (models, images, fonts). Returning from
// preload guarantees the robot model is ready for the first frame.
function preload() {
  // loadModel(path, normalizeSize, successCallback, errorCallback)
  robot = loadModel('robot.obj', true, handleModel, handleError);
}


// ===== setup() =====
// p5.js calls setup() once when the page loads. We use it to create the
// canvas, build the FFT analyzer, place HTML buttons, and seed the
// background star field.
function setup() {
  // Create a 1000x1000 canvas in 3D mode (WEBGL). WEBGL unlocks 3D shapes,
  // lights, materials, etc.
  createCanvas(1000, 1000, WEBGL);

  // FFT (Fast Fourier Transform) breaks audio into frequency bands.
  // First arg is smoothing (0 = jumpy, 1 = sluggish). 1024 is the sample size.
  fft = new p5.FFT(0.85, 1024);

  // ----- HTML buttons that overlay the canvas -----
  // File picker for the user to choose an audio file from their computer.
  let btn = createFileInput(handleFile);
  btn.position(20, 20);
  btn.attribute('accept', 'audio/*'); // restrict picker to audio files

  // Play / Pause button — calls togglePlay() when clicked.
  let playBtn = createButton('Play / Pause');
  playBtn.position(160, 20);
  playBtn.mousePressed(togglePlay);

  // Outline color toggle button — switches the whole color theme.
  outlineBtn = createButton('Outline: Green');
  outlineBtn.position(270, 20);
  outlineBtn.mousePressed(toggleOutlineColor);

  // ----- Build the background star field -----
  // FOR LOOP PURPOSE: run 200 times to create 200 star objects, each with
  // a random position, size, and the hue value. Pushing them into bgStars
  // lets us reuse the same stars every frame in draw() instead of making
  // new ones (which would be slow).
  for (let i = 0; i < 200; i++) {
    bgStars.push({
      x: random(-width, width),     // random horizontal position
      y: random(-height, height),   // random vertical position
      z: random(-800, -200),        // random depth (negative = farther back)
      baseSize: random(2, 7),       // each star's resting size
      hue: random(360)              // a per-star phase used for drift
    });
  }

  // RGB color mode with channel range 0..255 (the p5 default, set explicitly here).
  colorMode(RGB, 255);
}


// ===== handleFile(file) =====
// Called when the user picks an audio file from the file input.
// Stops any previously playing track, then loads + loops the new one.
function handleFile(file) {
  if (file.type === 'audio') {
    // If a sound is already playing, clean it up first
    if (sound) {
      sound.stop();
      sound.disconnect();
    }
    // loadSound is async — its callback fires once decoding is finished.
    sound = loadSound(file.data, () => {
      loaded = true;        // tell draw() it's safe to analyze audio
      fft.setInput(sound);  // route this sound into the FFT analyzer
      sound.loop();         // start playing on repeat
    });
  } else {
    console.warn('Please load an audio file.');
  }
}


// ===== togglePlay() =====
// Wired to the Play/Pause button. Pauses if playing, resumes (loops) if paused.
function togglePlay() {
  if (!sound || !loaded) return; // nothing to do if no track is loaded
  if (sound.isPlaying()) {
    sound.pause();
  } else {
    sound.loop();
  }
}


// ===== toggleOutlineColor() =====
// Wired to the Outline button. Flips between green and red themes and
// updates the button label so the user can see the current state.
function toggleOutlineColor() {
  outlineColor = (outlineColor === 'green') ? 'red' : 'green';
  outlineBtn.html('Outline: ' + (outlineColor === 'green' ? 'Green' : 'Red'));
}


// ===== draw() =====
// p5.js calls draw() 60 times per second. Everything you see on screen
// is rebuilt from scratch each frame. This function reads the current
// audio energy and uses it to drive colors, lights, and motion.
function draw() {
  // Default values when no audio is playing yet
  let bassN   = 0;
  let midN    = 0;
  let trebleN = 0;
  let level   = 0;

  // Only analyze audio if a track is loaded and is currently playing
  if (loaded && sound.isPlaying()) {
    fft.analyze();                                  // grab the latest frequency snapshot
    bassN   = fft.getEnergy('bass')    / 255;       // 0..1 normalized bass
    midN    = fft.getEnergy('mid')     / 255;       // 0..1 normalized mids
    trebleN = fft.getEnergy('treble')  / 255;       // 0..1 normalized treble
    level   = (bassN + midN + trebleN) / 3;         // overall loudness average
  }

  //  used everywhere below to swap palette
  let isRed = (outlineColor === 'red');

  // ---------- REACTIVE BACKGROUND ----------
  // Mix the canvas background color from the three frequency bands.
  if (isRed) {
    // Hot red / crimson theme
    let bgR = map(bassN,   0, 1, 40, 200);
    let bgG = map(midN,    0, 1,  5,  30);
    let bgB = map(trebleN, 0, 1,  5,  40);
    background(bgR, bgG, bgB);
  } else {
    // Default cool theme
    let bgR = map(bassN,   0, 1, 10, 120);
    let bgG = map(midN,    0, 1, 10,  60);
    let bgB = map(trebleN, 0, 1, 25, 180);
    background(bgR, bgG, bgB);
  }

  // ---------- RADIAL GLOW ----------
  // A stack of 6 fading ellipses way behind the scene that pulse in size.
  push();                                 // save current transform
  translate(0, 0, -900);                  // push the glow far behind everything
  noStroke();
  let glowSize = map(level, 0, 1, 1200, 2400); // overall loudness drives size

  // FOR LOOP: glow effect.
  // We draw 6 circles, each progressively smaller and slightly
  // more opaque, to fake a soft gradient.
  // Counting DOWN (i = 6 → 1) ensures the largest dim circle is drawn first
  // and smaller brighter circles stack on top — simulating bloom.
  for (let i = 6; i > 0; i--) {
    if (isRed) {
      fill(
        map(bassN,   0, 1, 180, 255),
        map(midN,    0, 1,  30, 120),
        map(trebleN, 0, 1,  20,  90),
        20 + i * 6                       // alpha grows with each inner ring
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
  pop();                                  // restore transform

  // ---------- BACKGROUND STAR FIELD ----------
  push();
  noStroke();

  // FOR LOOP PURPOSE: walk through every star object created in setup()
  // and draw it. Using "for...of"  makes the code
  // read as "for each star in bgStars, do this". On every frame we also
  // move the star's x/y so it feels alive.
  for (let s of bgStars) {
    let tw = 0.5 + trebleN * 2.5;        // treble makes stars twinkle bigger
    let sz = s.baseSize * tw;
    push();
    translate(s.x, s.y, s.z);            // move to this star's spot
    if (isRed) {
      fill(255, 80 + midN * 100, 80 + trebleN * 60, 150 + bassN * 105);
    } else {
      fill(200 + trebleN * 55, 180 + midN * 75, 255, 150 + bassN * 105);
    }
    sphere(sz, 6, 6);                    // small low-poly sphere = a "star"
    pop();
    // Gentle organic drift keeps it varied.
    s.x += sin(frameCount * 0.005 + s.hue) * 0.3;
    s.y += cos(frameCount * 0.005 + s.hue) * 0.3;
  }
  pop();

  orbitControl();                         // let mouse drag rotate the camera

  // ---------- LIGHTS ----------
  // ambientLight = baseline brightness so nothing is pitch black.
  ambientLight(map(bassN, 0, 1, 30, 90));

  // directionalLight coming from a direction. Color shifts with treble.
  if (isRed) {
    let rR = map(trebleN, 0, 1, 200, 255);
    let rG = map(trebleN, 0, 1,  40, 140);
    directionalLight(rR, rG, 40, 0, -1, -1);
  } else {
    let r = map(trebleN, 0, 1, 120, 255);
    let b = map(trebleN, 0, 1, 255, 120);
    directionalLight(r, 140, b, 0, -1, -1);
  }

  // Two point lights orbit the robot to create moving specular highlights.
  let t = frameCount * 0.02;              // time variable that grows each frame
  let orbitR = 400;
  if (isRed) {
    pointLight(255, 60 + midN * 120, 40,  cos(t) * orbitR, sin(t) * orbitR * 0.5, 300);
    pointLight(255, 120 + trebleN * 80, 60, cos(t + PI) * orbitR, sin(t + PI) * orbitR * 0.5, 300);
  } else {
    pointLight(255, 80 + midN * 175, 200, cos(t) * orbitR, sin(t) * orbitR * 0.5, 300);
    pointLight(80 + trebleN * 175, 200, 255, cos(t + PI) * orbitR, sin(t + PI) * orbitR * 0.5, 300);
  }
  // White top light keeps the top of the robot lit.
  pointLight(255, 255, 255, 0, -400, 200);

  // ---------- ROBOT ----------
  push();

  // Treble drives spin speed, then ir adds a spin so it always rotates.
  let spinSpeed = map(trebleN, 0, 1, 0.01, 0.12);
  angle += spinSpeed + 0.01;

  rotateX(angle * 0.4);                   // tumble on X
  rotateY(angle);                         // main spin on Y

  // Bass drives a scale pulse — robot grows on heavy bass hits.
  let scaleFactor = map(bassN, 0, 1, 1.6, 3.6);
  scale(scaleFactor);

  // Camera shakes on really loud bass.
  if (bassN > 0.75) {
    translate(random(-6, 6), random(-6, 6), 0);
  }

  // Materials: combine ambient + specular + shininess for chrome look.
  ambientMaterial(60, 70, 90);
  specularMaterial(255, 255, 255);
  shininess(map(trebleN, 0, 1, 60, 200));

  // Neon outline color depends on theme. Bass thickens the lines.
  if (outlineColor === 'green') {
    stroke(0, 255, 120, 220);
  } else {
    stroke(255, 40, 60, 220);
  }
  strokeWeight(map(bassN, 0, 1, 1.2, 3.5));

  model(robot);                           // finally draw the model
  pop();

  // ---------- FFT RINGS (all around) ----------
  let spectrum = fft.analyze();           // full frequency spectrum array (1024 numbers)
  push();
  noFill();
  strokeWeight(20);

  // Ring 1 — front-facing ring on the XY plane.
  if (isRed) {
    stroke(255, 60, 80, 200);
  } else {
    stroke(255, 80, 220, 180);
  }
  beginShape();
  // FOR LOOP: builds a closed polygon out of spectrum samples.
  // We step through `spectrum` in jumps of 30 (not every value, this would make it too dense). For each sample it:
  //   1. Convert its index to an angle around the circle (0 to TWO_PI)
  //   2. Convert its loudness to a radius (loud freq = ring pushed out)
  //   3. Place a vertex at (cos*radius, sin*radius) — polar to cartesian.
  // The resulting jagged ring is the audio spectrum bent into a circle.
  for (let i = 0; i < spectrum.length; i += 30) {
    let a = map(i, 0, spectrum.length, 0, TWO_PI);
    let r2 = map(spectrum[i], 0, 255, 440, 820);
    vertex(r2 * cos(a), r2 * sin(a), 0);
  }
  endShape(CLOSE);                        // CLOSE joins last vertex back to first

  // Ring 2 — same idea but slowly tumbles on X and Y for 3D coverage.
  push();
  rotateY(frameCount * 0.008);
  rotateX(frameCount * 0.005);
  if (isRed) {
    stroke(255, 160, 60, 200);
  } else {
    stroke(255, 220, 120, 180);
  }
  beginShape();
  // FOR LOOP: identical to Ring 1's loop, but with a slightly
  // larger radius range so the ring sits outside of Ring 1.
  for (let i = 0; i < spectrum.length; i += 30) {
    let a = map(i, 0, spectrum.length, 0, TWO_PI);
    let r2 = map(spectrum[i], 0, 255, 460, 840);
    vertex(r2 * cos(a), r2 * sin(a), 0);
  }
  endShape(CLOSE);
  pop();

  pop();
}


// ===== handleError(error) =====
// Callback for loadModel() if it can't fetch the file.
// Logs to the browser console so you can see the failure during debugging.
function handleError(error) {
  console.error('Model load error:', error);
}


// ===== handleModel(data) =====
// Callback for loadModel() 
// Stores the geometry in the `robot` variable.
function handleModel(data) {
  robot = data;
  console.log('Robot model loaded');
}
