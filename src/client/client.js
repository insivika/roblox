import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { JoyStick } from "./libs/toon3d";

class Game {
  constructor() {
    this.container;
    this.player = {};
    this.stats;
    this.controls;
    this.camera;
    this.scene;
    this.renderer;
    this.animations = {};
    this.animationNames = [
      "Walking",
      "Walking Backwards",
      "Turn",
      "Running",
      "Pointing Gesture",
    ];
    this.container = document.createElement("div");
    this.container.style.height = "100%";
    document.body.appendChild(this.container);

    this.assetsPath = "./assets/";

    this.clock = new THREE.Clock();

    this.init();

    window.onError = function (error) {
      console.error(JSON.stringify(error));
    };
  }

  init() {
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      1,
      2000
    );
    this.camera.position.set(112, 100, 400);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xa0a0a0);
    this.scene.fog = new THREE.Fog(0xa0a0a0, 200, 1000);

    let light = new THREE.HemisphereLight(0xffffff, 0x444444);
    light.position.set(0, 200, 0);
    this.scene.add(light);

    light = new THREE.DirectionalLight(0xffffff);
    light.position.set(0, 200, 100);
    light.castShadow = true;
    light.shadow.camera.top = 180;
    light.shadow.camera.bottom = -100;
    light.shadow.camera.left = -120;
    light.shadow.camera.right = 120;
    this.scene.add(light);

    // ground
    var mesh = new THREE.Mesh(
      new THREE.PlaneBufferGeometry(2000, 2000),
      new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    var grid = new THREE.GridHelper(2000, 40, 0x000000, 0x000000);
    grid.material.opacity = 0.2;
    grid.material.transparent = true;
    this.scene.add(grid);

    // model
    const loader = new FBXLoader();
    const game = this;

    loader.load(
      `${this.assetsPath}fbx/people/FireFighter.fbx`,
      async (object) => {
        object.mixer = new THREE.AnimationMixer(object);
        game.player.mixer = object.mixer;
        game.player.root = object.mixer.getRoot();

        object.name = "FireFighter";

        object.traverse(function (child) {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = false;
          }
        });

        const tLoader = new THREE.TextureLoader();
        tLoader.load(
          `${game.assetsPath}images/SimplePeople_FireFighter_Brown.png`,
          function (texture) {
            object.traverse(function (child) {
              if (child.isMesh) {
                child.material.map = texture;
              }
            });
          }
        );

        game.scene.add(object);
        game.player.object = object;
        game.animations.Idle = object.animations[0];

        await game.loadAnimations(loader);

        console.log(game.animations);

        game.loadInitialAction();
      }
    );

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 150, 0);
    this.controls.update();

    window.addEventListener(
      "resize",
      function () {
        game.onWindowResize();
      },
      false
    );
  }

  loadAnimations = async (loader) => {
    const game = this;
    await Promise.all(
      game.animationNames.map(async (animationName) => {
        return new Promise((resolve, reject) => {
          loader.load(
            `./assets/fbx/anims/${animationName}.fbx`,
            function (object) {
              game.animations[animationName] = object.animations[0];
              resolve();
            }
          );
        });
      })
    );
  };

  setAction = (name) => {
    const action = this.player.mixer.clipAction(this.animations[name]);
    action.time = 0;
    this.player.mixer.stopAllAction();
    this.player.action = name;
    this.player.actionTime = Date.now();
    this.player.actionName = name;

    action.fadeIn(0.5);
    action.play();
  };

  getAction = () => {
    if (this.player === undefined || this.player.actionName === undefined)
      return "";
    return this.player.actionName;
  };

  loadInitialAction = () => {
    this.setAction("Idle");
    this.animate();
  };

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    const game = this;
    const dt = this.clock.getDelta();

    requestAnimationFrame(function () {
      game.animate();
    });

    if (this.player.mixer !== undefined) this.player.mixer.update(dt);

    this.renderer.render(this.scene, this.camera);
  }
}

new Game();
