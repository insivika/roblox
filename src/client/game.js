import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import JoyStick from "./utils/Joystick";
import Preloader from "./utils/Preloader";
import { PlayerLocal, Player } from "./Player";
import SpeechBubble from "./SpeechBubble";
import delay from "delay";

class Game {
  constructor() {
    this.modes = Object.freeze({
      NONE: Symbol("none"),
      PRELOAD: Symbol("preload"),
      INITIALIZING: Symbol("initializing"),
      CREATING_LEVEL: Symbol("active"),
      GAMEOVER: Symbol("gameover"),
    });
    this.container;
    this.controls;
    this.camera;
    this.cameras;
    this.scene;
    this.renderer;
    this.animations = {};
    this.remotePlayers = [];
    this.remoteColliders = [];
    this.initializingPlayers = [];
    this.assetsPath = "./assets/";
    const game = this;
    this.animationNames = [
      "Walking",
      "Walking Backwards",
      "Turn",
      "Running",
      "Pointing Gesture",
    ];

    const options = {
      assets: [
        `${this.assetsPath}images/nx.jpg`,
        `${this.assetsPath}images/px.jpg`,
        `${this.assetsPath}images/ny.jpg`,
        `${this.assetsPath}images/py.jpg`,
        `${this.assetsPath}images/nz.jpg`,
        `${this.assetsPath}images/pz.jpg`,
      ],
      oncomplete: () => {
        game.init();
      },
    };

    this.animationNames.forEach(function (animationName) {
      options.assets.push(`${game.assetsPath}fbx/anims/${animationName}.fbx`);
    });

    this.mode = this.modes.PRELOAD;

    this.clock = new THREE.Clock();

    this.container = document.createElement("div");
    this.container.style.height = "100%";
    document.body.appendChild(this.container);

    const preloader = new Preloader(options);

    window.onError = function (error) {
      console.error(JSON.stringify(error));
    };
  }

  init() {
    this.mode = this.modes.INITIALIZING;
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

    this.player = new PlayerLocal(this);

    this.loadEnvironment(loader);

    this.speechBubble = new SpeechBubble(this, "", 150);
    this.speechBubble.mesh.position.set(0, 350, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    // this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    // this.controls.target.set(0, 150, 0);
    // this.controls.update();

    if ("ontouchstart" in window) {
      window.addEventListener(
        "touchdown",
        (event) => game.onMouseDown(event),
        false
      );
    } else {
      window.addEventListener(
        "mousedown",
        (event) => game.onMouseDown(event),
        false
      );
    }

    window.addEventListener(
      "resize",
      function () {
        game.onWindowResize();
      },
      false
    );
  }

  onMouseDown = (event) => {
    console.log({
      "this.remoteColliders": this.remoteColliders,
      "this.remoteColliders.length": this.remoteColliders.length,
      "this.speechBubble": this.speechBubble,
      "this.speechBubble.mesh": this.speechBubble.mesh,
    });

    if (
      this.remoteColliders === undefined ||
      this.remoteColliders.length == 0 ||
      this.speechBubble === undefined ||
      this.speechBubble.mesh === undefined
    )
      return;

    // Calculate mouse position in normalized device coordinates
    //  (-1 to +1) for both axies
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / this.renderer.domElement.width) * 2 - 1;
    mouse.y = -(event.clientY / this.renderer.domElement.height) * 2 + 1;

    console.log("this.camera ==> ", this.camera);

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);

    const intersections = raycaster.intersectObjects(this.remoteColliders);
    const chatBox = document.getElementById("chat");

    console.log("intersections => ", intersections);

    if (intersections.length > 0) {
      const intersectionObject = intersections[0].object;
      const players = this.remotePlayers.filter((player) => {
        if (
          player.collider !== undefined &&
          player.collider == intersectionObject
        ) {
          return true;
        }
      });

      if (players.length) {
        const player = players[0];
        console.log(`onMousedown: player ${player.id}`);
        this.speechBubble.player = player;
        this.speechBubble.update("");
        this.scene.add(this.speechBubble.mesh);
        this.chatSocketId = player.id;
        chatBox.style.display = "block";
        this.activeCamera = this.camera.chat;
      }
    } else {
      // Check if the chat panel is visible
      if (chatBox.style.display == "block") {
        console.log("onMousedown: no player found");
        if (this.speechBubble.mesh.parent !== null) {
          this.speechBubble.mesh.parent.remove(this.speechBubble.mesh);

          delete this.speechBubble.player;
          delete this.chatSocketId;
          chat.style.display = "none";
          this.activeCamera = this.camera.back;
        }
      } else {
        console.log("onMousedown: typing");
      }
    }
  };

  loadEnvironment = async (loader) => {
    const game = this;
    loader.load(`${this.assetsPath}fbx/town.fbx`, async (object) => {
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
    });

    // TODO: This might need to go into the function above
    await game.loadAnimations(loader);

    this.loadInitialAction();
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

  getAction = () => {
    if (this.player === undefined || this.player.actionName === undefined)
      return "";
    return this.player.actionName;
  };

  loadInitialAction = async () => {
    this.joystick = new JoyStick({
      onMove: this.playerControl,
      game: this,
    });
    // Awaiting player to load
    // TODO: make this call dependant on player having loaded
    await delay(1500);
    this.player.setAction("Idle");
    this.mode = this.modes.ACTIVE;
    this.animate();
  };

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  updateRemotePlayers = (dt) => {
    if (
      this.remoteData === undefined ||
      this.remoteData.length == 0 ||
      this.player === undefined ||
      this.player.id === undefined
    )
      return;

    const game = this;
    const remotePlayers = [];
    const remoteColliders = [];

    this.remoteData.forEach((data) => {
      if (game.player.id != data.id) {
        let iPlayer;
        game.initializingPlayers.forEach((player) => {
          if (player.id == data.id) iPlayer = player;
        });

        if (iPlayer === undefined) {
          let rPlayer;
          game.remotePlayers.forEach((player) => {
            if (player.id == data.id) rPlayer = player;
          });

          if (rPlayer === undefined) {
            game.initializingPlayers.push(new Player(game, data));
          } else {
            // Push the remote player
            remotePlayers.push(rPlayer);
            remoteColliders.push(rPlayer.collider);
          }
        }
      }
    });

    this.scene.children.forEach((object) => {
      if (
        object.userData.remotePlayer &&
        game.getRemotePlayerById(object.userData.id) == undefined
      ) {
        game.scene.remove(object);
      }
    });

    this.remotePlayers = remotePlayers;
    this.remoteColliders = remoteColliders;

    this.remotePlayers.forEach(function (player) {
      player.update(dt);
    });
  };

  getRemotePlayerById = (id) => {
    if (this.remotePlayers === undefined || this.remotePlayers.length == 0)
      return;

    const players = this.remotePlayers.filter(function (player) {
      if (player.id == id) return true;
    });

    if (players.length == 0) return;

    return players[0];
  };

  playerControl = (forward, turn) => {
    turn = -turn;

    if (forward > 0.3) {
      if (
        this.player.actionName != "Walking" &&
        this.player.actionName != "Running"
      )
        this.player.setAction("Walking");
    } else if (forward < -0.3) {
      if (this.player.actionName != "Walking Backwards")
        this.player.setAction("Walking Backwards");
    } else {
      forward = 0;
      if (Math.abs(turn) > 0.1) {
        if (this.player.actionName != "Turn") this.player.setAction("Turn");
      } else if (this.player.actionName != "Idle") {
        this.player.setAction("Idle");
      }
    }
    if (forward == 0 && turn == 0) {
      delete this.player.motion;
    } else {
      this.player.motion = { forward, turn };
    }

    this.player.updateSocket();
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
    // TODO: chat is a key
    this.cameras = { front, back, wide, overhead, collect };

    this.activeCamera(this.cameras.back);
  };

  activeCamera = (object) => {
    this.cameras.active = object;
  };

  animate() {
    const game = this;
    const dt = this.clock.getDelta();

    requestAnimationFrame(function () {
      game.animate();
    });

    this.updateRemotePlayers(dt);

    if (this.player.mixer !== undefined && this.mode === this.modes.ACTIVE)
      this.player.mixer.update(dt);

    if (this.player.actionName == "Walking") {
      const elapsedTime = Date.now() - this.player.actionTime;
      if (elapsedTime > 1000 && this.player.motion.forward > 0) {
        this.player.setAction("Running");
      }
    }

    if (this.player.motion !== undefined) this.player.move(dt);

    if (
      (this.cameras != undefined &&
        this.cameras.active != undefined &&
        this.player,
      this.player.object !== undefined)
    ) {
      this.camera.position.lerp(
        this.cameras.active.getWorldPosition(new THREE.Vector3()),
        0.05
      );
      const pos = this.player.object.position.clone();

      if (this.cameras.active == this.cameras.chat) {
        pos.y += 200;
      } else {
        pos.y += 400;
      }

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
