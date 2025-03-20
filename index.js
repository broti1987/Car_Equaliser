import * as THREE from "three";
import { OrbitControls } from "jsm/controls/OrbitControls.js";
import { GLTFLoader } from "jsm/loaders/GLTFLoader.js";
import { EffectComposer } from "jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "jsm/postprocessing/UnrealBloomPass.js";

const w = window.innerWidth;
const h = window.innerHeight;
const clock = new THREE.Clock();


// Preloader
const preloader = document.createElement("div");
preloader.style.position = "absolute";
preloader.style.top = "0";
preloader.style.left = "0";
preloader.style.width = "100%";
preloader.style.height = "100%";
preloader.style.background = "black";
preloader.style.display = "flex";
preloader.style.alignItems = "center";
preloader.style.justifyContent = "center";
preloader.style.flexDirection = "column";
preloader.style.color = "#52EACA";
preloader.style.fontSize = "20px";
preloader.style.fontFamily = "sans-serif";
document.body.appendChild(preloader);

const loadingText = document.createElement("div");
loadingText.innerText = "Loading: 0%";
loadingText.style.marginBottom = "10px";
preloader.appendChild(loadingText);

const loadingBar = document.createElement("div");
loadingBar.style.width = "0%";
loadingBar.style.height = "4px";
loadingBar.style.background = "#52EACA";
loadingBar.style.transition = "width 0.5s";
preloader.appendChild(loadingBar);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(w, h);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Add Play Button to UI
const playButton = document.createElement("button");
playButton.innerText = "PLAY";
playButton.style.position = "absolute";
playButton.style.bottom = "20px";
playButton.style.right = "20px";
playButton.style.padding = "10px 20px";
playButton.style.fontSize = "1em";
playButton.style.background = "black";
playButton.style.color = "#52EACA";
playButton.style.border = "2px solid #52EACA";
playButton.style.textTransform = "uppercase";
playButton.style.cursor = "pointer";
document.body.appendChild(playButton);

// Add Reset Button to UI
const resetButton = document.createElement("button");
resetButton.innerText = "\u21BB";
resetButton.style.position = "absolute";
resetButton.style.bottom = "20px";
resetButton.style.left = "20px";
resetButton.style.padding = "10px 20px";
resetButton.style.fontSize = "1em";
resetButton.style.background = "black";
resetButton.style.color = "#52EACA";
resetButton.style.border = "2px solid #52EACA";
resetButton.style.textTransform = "uppercase";
resetButton.style.cursor = "pointer";
document.body.appendChild(resetButton);


// Camera
const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 10);
camera.position.set(0, 1, 2);

// Scene
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x000000, 2, 6);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Lighting
const hemiLight = new THREE.HemisphereLight(0x89FFA5 ,0x00CCFF, 3);
scene.add(hemiLight);

// Particle Group
const particleGroup = new THREE.Group();
scene.add(particleGroup);

// Particle Variables
let particles = [];
let originalPositions = [];
let particleScales = [];
let randomOffsets = [];
let displacementFactors = [];

const maxDisplacementFactor = 100;
const hoverStrength = 1;
const returnSpeed = 0.05;
const maxScaleFactor = 300;
const scaleSpeed = 0.1;

// Audio Processing
const audio = new Audio("anxiety_full.mp3"); // Replace with your audio file
audio.loop = true;
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const analyser = audioContext.createAnalyser();
analyser.fftSize = 256;
const dataArray = new Uint8Array(analyser.frequencyBinCount);

const source = audioContext.createMediaElementSource(audio);
source.connect(analyser);
analyser.connect(audioContext.destination);

// Toggle audio on Play Button Click
playButton.addEventListener("click", () => {
    if (audioContext.state === "suspended") {
        audioContext.resume();
    }
    if (audio.paused) {
        audio.play();
        playButton.innerText = "PAUSE";
    } else {
        audio.pause();
        playButton.innerText = "PLAY";
    }
});


// Reset Button Click - Stop audio and reset to start
resetButton.addEventListener("click", () => {
    audio.pause();
    audio.currentTime = 0;
    playButton.innerText = "PLAY";
});

// Post-processing setup
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 1.5, 0.4, 0.85);
bloomPass.threshold = 0;
bloomPass.strength = 1.2;
bloomPass.radius = 0.5;
composer.addPass(bloomPass);

// Utility function for random values
const getRandomVector = (scale = 1) =>
    new THREE.Vector3(
        (Math.random() - 0.5) * scale,
        (Math.random() - 0.5) * scale,
        (Math.random() - 0.5) * scale
    );

function updateParticles() {
    analyser.getByteFrequencyData(dataArray);
    
    const bass = dataArray.slice(0, dataArray.length / 3).reduce((sum, val) => sum + val, 0) / (dataArray.length / 3) / 255;
    const treble = dataArray.slice(dataArray.length * 2 / 3).reduce((sum, val) => sum + val, 0) / (dataArray.length / 3) / 255;

    particles.forEach((particle, index) => {
        const originalPos = originalPositions[index];
        
        let displacementStrength = bass;
        let scaleStrength = treble;

        const randomDisplacement = randomOffsets[index]
            .clone()
            .multiplyScalar(displacementStrength * hoverStrength * displacementFactors[index]);
        const targetPosition = originalPos.clone().add(randomDisplacement);

        particle.position.lerp(targetPosition, 0.1);

        const targetScale = 1 + scaleStrength * (1 + Math.random() * (maxScaleFactor - 1));
        particle.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), scaleSpeed);
    });
}

// Load Model & Create Particles
const loader = new GLTFLoader().setPath("cat/");
loader.load("car.glb", function (gltf) {
    const model = gltf.scene;
    model.scale.set(0.8, 0.8, 0.8);
    model.rotation.z = -Math.PI/2; // Rotate 90 degrees on Z-axis

    model.traverse((child) => {
        if (child.isMesh) {
            child.visible = false;

            const geometry = child.geometry;
            const positions = geometry.attributes.position.array;

            for (let i = 0; i < positions.length; i += 3) {
                const vertex = new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]);
                vertex.multiplyScalar(0.8);

                const particle = new THREE.Mesh(
                    new THREE.SphereGeometry(0.005),
                    new THREE.MeshStandardMaterial({ color: 0xffffff })
                );

                particle.position.copy(vertex);
                particleGroup.add(particle);

                particles.push(particle);
                originalPositions.push(vertex.clone());
                particleScales.push(new THREE.Vector3(1, 1, 1));
                randomOffsets.push(getRandomVector(0.3));
                displacementFactors.push(Math.random() * maxDisplacementFactor);
            }
        }
    });

    scene.add(model);
    animate();
});

// Animation Loop
function animate() {
    requestAnimationFrame(animate);
    updateParticles();
    particleGroup.rotation.y += 0.01;
    composer.render();
    controls.update();
}

// Handle Window Resize
window.addEventListener("resize", () => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    composer.setSize(width, height);
});

// Hide preloader when loading completes
let progress = 0;
const interval = setInterval(() => {
    if (progress < 100) {
        progress += 10;
        loadingText.innerText = `Loading: ${progress}%`;
        loadingBar.style.width = `${progress}%`;
    } else {
        clearInterval(interval);
        setTimeout(() => {
            preloader.style.display = "none";
        }, 500);
    }
}, 200);
