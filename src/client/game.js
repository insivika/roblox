import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import JoyStick from "./utils/Joystick";

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
      10,
      200000
    );
    this.camera.position.set(112, 100, 600);

    this.scene = new THREE.Scene();

    this.scene.background = new THREE.Color(0x00a0f0);
    const ambient = new THREE.AmbientLight(0xaaaaaa);
    this.scene.add(ambient);

    const light = new THREE.DirectionalLight(0xaaaaaa);
    light.position.set(30, 100, 40);
    light.target.position.set(0, 0, 0);

    light.castShadow = true;

    const lightSize = 500;
    light.shadow.camera.near = 1;
    light.shadow.camera.far = 500;
    light.shadow.camera.left = light.shadow.camera.bottom = -lightSize;
    light.shadow.camera.right = light.shadow.camera.top = lightSize;

    light.shadow.bias = 0.0039;
    light.shadow.mapSize.width = 1024;
    light.shadow.mapSize.height = 1024;

    this.sun = light;
    this.scene.add(light);

    // model
    const loader = new FBXLoader();
    const game = this;

    this.loadEnvironment(loader);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    // this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    // this.controls.target.set(0, 150, 0);
    // this.controls.update();

    window.addEventListener(
      "resize",
      function () {
        game.onWindowResize();
      },
      false
    );
  }

  loadEnvironment = (loader) => {
    const game = this;

    // Player
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

        game.player.object = new THREE.Object3D();
        game.scene.add(game.player.object);
        game.player.object.position.set(3122, 0, -173);
        game.player.object.rotateY(90);
        game.player.object.add(object);
        game.animations.Idle = object.animations[0];

        await game.loadAnimations(loader);

        game.loadInitialAction();
      }
    );

    // Town
    loader.load(`${this.assetsPath}fbx/town.fbx`, (object) => {
      game.environment = object;
      game.colliders = [];
      game.scene.add(object);

      object.traverse((child) => {
        if (child.isMesh) {
          if (child.name.startsWith("proxy")) {
            game.colliders.push(child);
            child.material.visible = false;
          } else {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        }
      });

      const tLoader = new THREE.CubeTextureLoader();
      tLoader.setPath(`${game.assetsPath}/images/`);

      const textureCube = tLoader.load([
        "px.jpg",
        "nx.jpg",
        "py.jpg",
        "ny.jpg",
        "pz.jpg",
        "nz.jpg",
      ]);

      game.scene.background = textureCube;

      game.animate();
    });
  };

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

    action
      .reset()
      .setEffectiveTimeScale(1)
      .setEffectiveWeight(1)
      //   .fadeIn(0.5)
      .play();
  };

  getAction = () => {
    if (this.player === undefined || this.player.actionName === undefined)
      return "";
    return this.player.actionName;
  };

  loadInitialAction = () => {
    this.createCameras();
    this.joystick = new JoyStick({
      onMove: this.playerControl,
      game: this,
    });
    this.setAction("Idle");
    this.animate();
  };

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  playerControl = (forward, turn) => {
    turn = -turn;

    if (forward > 0.3) {
      if (this.player.action != "Walking" && this.player.action != "Running")
        this.setAction("Walking");
    } else if (forward < -0.3) {
      if (this.player.action != "Walking Backwards")
        this.setAction("Walking Backwards");
    } else {
      forward = 0;
      if (Math.abs(turn) > 0.1) {
        if (this.player.action != "Turn") this.setAction("Turn");
      } else if (this.player.action != "Idle") {
        this.setAction("Idle");
      }
    }
    if (forward == 0 && turn == 0) {
      delete this.player.move;
    } else {
      this.player.move = { forward, turn };
    }
  };

  movePlayer = (dt) => {
    const position = this.player.object.position.clone();
    position.y += 60;
    let direction = new THREE.Vector3();
    this.player.object.getWorldDirection(direction);
    if (this.player.move.forward < 0) direction.negate();
    let raycaster = new THREE.Raycaster(position, direction);
    let blocked = false;
    const colliders = this.colliders;

    if (colliders !== undefined) {
      let intersect = raycaster.intersectObjects(colliders);

      if (intersect.length > 0) {
        if (intersect[0].distance < 50) blocked = true;
      }
      // Cast Left
      // Cast Right
      // Cast down
      direction.set(0, -1, 0);
      position.y += 200;
      raycaster = new THREE.Raycaster(position, direction);

      const gravity = 30;
      intersect = raycaster.intersectObjects(colliders);
      // Check for intersection collected in the intersect array
      if (intersect.length > 0) {
        const targetY = position.y - intersect[0].distance;
        if (targetY > this.player.object.position.y) {
          // Go up
          this.player.object.position.y =
            0.8 * this.player.object.position.y + 0.2 * targetY;
          this.player.velocityY = 0;
        } else if (targetY < this.player.object.position.y) {
          //Falling
          if (this.player.velocityY == undefined) this.player.velocityY = 0;
          this.player.velocityY += dt * gravity;
          this.player.object.position.y -= this.player.velocityY;
          if (this.player.object.position.y < targetY) {
            this.player.velocityY = 0;
            this.player.object.position.y = targetY;
          }
        }
      } else if (this.player.object.position.y > 0) {
        if (this.player.velocityY == undefined) this.player.velocityY = 0;
        this.player.velocityY += dt * gravity;
        this.player.object.position.y -= this.player.velocityY;
        if (this.player.object.position.y < 0) {
          this.player.velocityY = 0;
          this.player.object.position.y = 0;
        }
      }
    }

    if (!blocked) {
      if (this.player.move.forward > 0) {
        const speed = this.player.action == "Running" ? 400 : 150;
        this.player.object.translateZ(dt * speed);
      } else {
        this.player.object.translateZ(-dt * 30);
      }
    }

    this.player.object.rotateY(this.player.move.turn * dt);
  };

  createCameras = () => {
    const front = new THREE.Object3D();
    front.position.set(112, 100, 600);
    front.parent = this.player.object;
    const back = new THREE.Object3D();
    back.position.set(0, 300, -1050);
    back.parent = this.player.object;
    const wide = new THREE.Object3D();
    wide.position.set(178, 139, 1665);
    wide.parent = this.player.object;
    const overhead = new THREE.Object3D();
    overhead.position.set(0, 400, 0);
    overhead.parent = this.player.object;
    const collect = new THREE.Object3D();
    collect.position.set(40, 82, 94);
    collect.parent = this.player.object;
    this.player.cameras = { front, back, wide, overhead, collect };
    this.activeCamera(this.player.cameras.back);
  };

  activeCamera = (object) => {
    this.player.cameras.active = object;
  };

  animate() {
    const game = this;
    const dt = this.clock.getDelta();

    requestAnimationFrame(function () {
      game.animate();
    });

    if (this.player.mixer !== undefined) this.player.mixer.update(dt);

    if (this.player.action == "Walking") {
      const elapsedTime = Date.now() - this.player.actionTime;
      if (elapsedTime > 1000 && this.player.move.forward > 0) {
        this.setAction("Running");
      }
    }

    if (this.player.move !== undefined) this.movePlayer(dt);

    if (
      this.player.cameras != undefined &&
      this.player.cameras.active != undefined
    ) {
      this.camera.position.lerp(
        this.player.cameras.active.getWorldPosition(new THREE.Vector3()),
        0.05
      );
      const pos = this.player.object.position.clone();
      pos.y += 200;
      this.camera.lookAt(pos);
    }

    if (this.sun != undefined) {
      this.sun.position.x = this.player.object.position.x;
      this.sun.position.y = this.player.object.position.y + 200;
      this.sun.position.z = this.player.object.position.z + 100;
      this.sun.target = this.player.object;
    }

    this.renderer.render(this.scene, this.camera);
  }
}

new Game();
