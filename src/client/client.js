import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { JoyStick } from "./libs/toon3d";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa0a0a0);
scene.fog = new THREE.Fog(0xa0a0a0, 200, 1000);

// Camera
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

camera.position.set(50, 200, 350);

// Clock
const clock = new THREE.Clock();

// Render
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const render = () => {
  renderer.render(scene, camera);
};

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 150, 0);
controls.update();

// Hemisphere Light
let light = new THREE.HemisphereLight(0xffffff, 0x444444);
light.position.set(0, 200, 0);
scene.add(light);
// Directional Light
light = new THREE.DirectionalLight(0xffffff);
light.position.set(0, 200, 100);
light.castShadow = true;
light.shadow.camera.top = 180;
light.shadow.camera.bottom = -100;
light.shadow.camera.left = -120;
light.shadow.camera.right = 120;
scene.add(light);
const ambient = new THREE.AmbientLight(0x707070); // soft white light
scene.add(ambient);

// Ground
const mesh = new THREE.Mesh(
  new THREE.PlaneBufferGeometry(2000, 2000),
  new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false })
);
mesh.rotation.x = -Math.PI / 2;
mesh.position.y = -100;
mesh.receiveShadow = true;
scene.add(mesh);

// Grid Helper
const grid = new THREE.GridHelper(2000, 40, 0x000000, 0x000000);
grid.material.opacity = 0.2;
grid.material.transparent = true;
scene.add(grid);

// Model
const player = {};
const animations = {};
const animationNames = [
  "Walking",
  "Walking Backwards",
  "Turn",
  "Running",
  "Pointing Gesture",
];
const loader = new FBXLoader();
loader.load("./assets/fbx/people/FireFighter.fbx", async (object) => {
  object.mixer = new THREE.AnimationMixer(object);

  player.mixer = object.mixer;
  player.root = object.mixer.getRoot();

  object.name = "FireFighter";

  object.traverse(function (child) {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = false;
    }
  });

  const tLoader = new THREE.TextureLoader();

  tLoader.load(
    "./assets/images/SimplePeople_FireFighter_Brown.png",
    (texture) => {
      object.traverse((child) => {
        if (child.isMesh) {
          child.material.map = texture;
        }
      });
    }
  );

  scene.add(object);
  player.object = object;
  //   Set default animation
  animations.Idle = object.animations[0];

  await loadAnimations(loader);

  setAnimation();

  //   player.mixer.clipAction(object.animations[0]).play();
});

const setAction = (name) => {
  const action = player.mixer.clipAction(animations[name]);
  action.time = 0;
  player.mixer.stopAllAction();
  player.action = name;
  player.actionTime = Date.now();
  player.actionName = name;
  action.fadeIn(0.5);
  action.play();
};

const setAnimation = () => {
  //   createCameras();
  joystick = new JoyStick({
    //   onMove: playerControl,
    //   game: game,
  });
  setAction("Idle");
  animate();
};

const loadAnimations = async (loader) => {
  await Promise.all(
    animationNames.map(async (animationName) => {
      return new Promise((resolve, reject) => {
        loader.load(
          `./assets/fbx/anims/${animationName}.fbx`,
          function (object) {
            animations[animationName] = object.animations[0];
            resolve();
          }
        );
      });
    })
  );
};

// Handle Resizing Window
const onWindowResize = () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  render();
};
window.addEventListener("resize", onWindowResize, false);

const animate = () => {
  const dt = clock.getDelta();

  requestAnimationFrame(animate);

  if (player.mixer !== undefined) {
    player.mixer.update(dt);
  }
  render();
};

animate();
