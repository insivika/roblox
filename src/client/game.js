import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import JoyStick from "./utils/Joystick";
import Preloader from "./utils/Preloader";
import { PlayerLocal, Player } from "./Player";
import SpeechBubble from "./SpeechBubble";
import { NPC } from "./NPC";
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
    this.npcs = [];
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

    console.log("BEFORE setupKeyboardControls");
    // Setup keyboard controls immediately, before preloader
    this.setupKeyboardControls();
    console.log("AFTER setupKeyboardControls");

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

    this.scene.background = new THREE.Color(0x87ceeb);
    
    // Brighter ambient light for better visibility
    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambient);

    // Stronger directional light
    const light = new THREE.DirectionalLight(0xffffff, 0.6);
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
      game.streets = []; // Separate array for street meshes
      game.scene.add(object);

      console.log("=== ANALYZING CITY MODEL ===");
      const meshNames = new Set();
      const materialNames = new Set();

      object.traverse((child) => {
        if (child.isMesh) {
          meshNames.add(child.name);
          
          // Log material info
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => {
                materialNames.add(mat.name);
                // Fix material properties for visibility
                mat.needsUpdate = true;
              });
            } else {
              materialNames.add(child.material.name);
              // Fix material properties
              child.material.needsUpdate = true;
              
              // If material has no texture, give it a color
              if (!child.material.map) {
                child.material.color.setHex(0x808080);
              }
            }
          }
          
          // Check if this might be a street based on name
          const nameLower = child.name.toLowerCase();
          const isStreet = nameLower.includes('road') || 
                          nameLower.includes('street') || 
                          nameLower.includes('sidewalk') ||
                          nameLower.includes('pavement') ||
                          nameLower.includes('ground');
          
          if (child.name.startsWith("proxy")) {
            game.colliders.push(child);
            child.material.visible = false;
            
            if (isStreet) {
              game.streets.push(child);
              console.log(`Found street collider: ${child.name}`);
            }
          } else {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        }
      });

      console.log("Unique mesh names found:", Array.from(meshNames).sort());
      console.log("Unique material names found:", Array.from(materialNames).sort());
      console.log(`Total colliders: ${game.colliders.length}`);
      console.log(`Street colliders: ${game.streets.length}`);

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
      
      console.log(`City environment loaded`);
      
      // Load NPCs after environment is ready
      game.loadNPCs();
    });

    // TODO: This might need to go into the function above
    await game.loadAnimations(loader);

    this.loadInitialAction();
  };

  loadAnimations = async (loader) => {
    const game = this;

    // Create a custom loading manager that suppresses texture errors
    const loadingManager = new THREE.LoadingManager();
    loadingManager.onError = (url) => {
      // Silently ignore texture loading errors from animation files
      // These FBX files contain references to textures from the original author's system
      // We only need the animation data, not the textures
      if (url.includes("Dropbox") || url.includes(":/")) {
        // Suppress these expected errors
        return;
      }
      console.error("Error loading:", url);
    };

    // Create a dedicated FBX loader for animations with the custom manager
    const animLoader = new FBXLoader(loadingManager);

    await Promise.all(
      game.animationNames.map(async (animationName) => {
        return new Promise((resolve, reject) => {
          animLoader.load(
            `./assets/fbx/anims/${animationName}.fbx`,
            function (object) {
              game.animations[animationName] = object.animations[0];
              resolve();
            },
            undefined, // onProgress callback
            function (error) {
              // Error loading the FBX file itself (not textures)
              console.error(`Error loading animation ${animationName}:`, error);
              reject(error);
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

  setupKeyboardControls = () => {
    console.log("INSIDE setupKeyboardControls - START");

    // Initialize keyboard controls
    this.keys = {
      ArrowUp: false,
      ArrowDown: false,
      ArrowLeft: false,
      ArrowRight: false,
    };

    const game = this;

    console.log("Setting up keyboard controls...");

    // Keydown event - capture phase to get it before anything else
    window.addEventListener(
      "keydown",
      (event) => {
        console.log("Keydown event:", event.key); // Log ALL keys
        if (event.key in game.keys) {
          console.log("Arrow key pressed:", event.key);
          event.preventDefault();
          event.stopPropagation();
          game.keys[event.key] = true;
          game.updateKeyboardControls();
        }
      },
      true
    );

    console.log("Keydown listener added");

    // Keyup event - capture phase
    window.addEventListener(
      "keyup",
      (event) => {
        console.log("Keyup event:", event.key); // Log ALL keys
        if (event.key in game.keys) {
          console.log("Arrow key released:", event.key);
          event.preventDefault();
          event.stopPropagation();
          game.keys[event.key] = false;
          game.updateKeyboardControls();
        }
      },
      true
    );

    console.log("Keyup listener added");
    console.log("Keyboard controls ready!");
    console.log("INSIDE setupKeyboardControls - END");
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
    
    // NPCs are now loaded in loadEnvironment after colliders are ready
    
    this.mode = this.modes.ACTIVE;
    this.animate();
  };

  loadNPCs = () => {
    const npcModels = [
      "BeachBabe",
      "BusinessMan",
      "Doctor",
      "FireFighter",
      "Housewife",
      "Policeman",
      "Prostitute",
      "Punk",
      "RiotCop",
      "Roadworker",
      "Robber",
      "Sheriff",
      "Streetman",
      "Trucker",
      "Waitress",
    ];

    console.log("Spawning NPCs at predefined street locations across the city");
    console.log("Player spawn: x=3122, z=-173");
    
    // Widely spread street coordinates - much further apart
    const streetSpawnPoints = [
      // Far west
      { x: 1000, z: -500 }, { x: 1200, z: 0 }, { x: 1500, z: 500 },
      // West
      { x: 2000, z: -800 }, { x: 2200, z: -200 }, { x: 2400, z: 400 },
      // Northwest to Southwest
      { x: 2600, z: -1000 }, { x: 2800, z: -600 }, { x: 2700, z: 600 }, { x: 2900, z: 1000 },
      // Near spawn but spread
      { x: 3000, z: -800 }, { x: 3200, z: 600 },
      // Northeast to Southeast  
      { x: 3400, z: -1000 }, { x: 3600, z: -600 }, { x: 3500, z: 700 }, { x: 3700, z: 1000 },
      // East
      { x: 4000, z: -700 }, { x: 4200, z: -100 }, { x: 4400, z: 500 },
      // Far east
      { x: 5000, z: -600 }, { x: 5200, z: 0 }, { x: 5500, z: 600 },
      // Extreme positions
      { x: 1500, z: -1200 }, { x: 5500, z: -1200 },
      { x: 1500, z: 1200 }, { x: 5500, z: 1200 },
      // Mid-range scattered
      { x: 2500, z: -400 }, { x: 3800, z: 300 }, { x: 4500, z: -300 },
    ];

    const raycaster = new THREE.Raycaster();
    const downDirection = new THREE.Vector3(0, -1, 0);
    
    // Spawn one NPC at each point (or random selection)
    for (let i = 0; i < Math.min(30, streetSpawnPoints.length); i++) {
      const point = streetSpawnPoints[i];
      const model = npcModels[Math.floor(Math.random() * npcModels.length)];
      const ry = Math.random() * Math.PI * 2;
      
      // Raycast to find exact ground height at this point
      const rayOrigin = new THREE.Vector3(point.x, 1000, point.z);
      raycaster.set(rayOrigin, downDirection);
      
      let groundY = 0;
      if (this.colliders && this.colliders.length > 0) {
        const intersects = raycaster.intersectObjects(this.colliders);
        if (intersects.length > 0) {
          groundY = intersects[0].point.y;
        }
      }
      
      console.log(`NPC ${i}: ${model} at x=${point.x}, y=${groundY.toFixed(1)}, z=${point.z}`);
      
      const npc = new NPC(this, {
        model: model,
        position: { x: point.x, y: groundY, z: point.z },
        rotation: { x: 0, y: ry, z: 0 },
      });
      this.npcs.push(npc);
    }

    console.log(`Spawned ${this.npcs.length} NPCs at street locations`);
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

  removePlayer = (player) => {
    // Properly dispose of player resources to prevent memory leaks
    if (player.dispose) {
      player.dispose();
    }

    // Remove from scene
    if (player.object && player.object.parent) {
      this.scene.remove(player.object);
    }

    // Remove from remote players array
    const index = this.remotePlayers.indexOf(player);
    if (index !== -1) {
      this.remotePlayers.splice(index, 1);
    }

    // Remove collider from remote colliders
    if (player.collider) {
      const colliderIndex = this.remoteColliders.indexOf(player.collider);
      if (colliderIndex !== -1) {
        this.remoteColliders.splice(colliderIndex, 1);
      }
    }
  };

  updateKeyboardControls = () => {
    // Safety check - make sure player exists
    if (!this.player || !this.player.object) {
      console.log("Player not ready yet");
      return;
    }

    let forward = 0;
    let turn = 0;

    if (this.keys.ArrowUp) forward += 1;
    if (this.keys.ArrowDown) forward -= 1;
    if (this.keys.ArrowLeft) turn -= 1;
    if (this.keys.ArrowRight) turn += 1;

    console.log("Keyboard controls:", { forward, turn });
    
    // Update joystick visual to match keyboard input
    if (this.joystick) {
      this.joystick.setPosition(forward, turn);
    }
    
    this.playerControl(forward, turn);
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

    // Update NPCs
    if (this.player && this.player.object) {
      const playerPos = this.player.object.position;
      const interactionRadius = 500; // Distance at which NPCs react
      
      this.npcs.forEach((npc) => {
        npc.update(dt);
        
        // Check if NPC object is loaded
        if (npc.object) {
          // Calculate distance to player
          const distance = playerPos.distanceTo(npc.object.position);
          
          // If player is close, NPC turns to face them
          if (distance < interactionRadius) {
            npc.lookAt(playerPos);
          }
        }
      });
    } else {
      // Fallback if player not ready
      this.npcs.forEach((npc) => {
        npc.update(dt);
      });
    }

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

console.log("============ ABOUT TO CREATE NEW GAME ============");
new Game();
console.log("============ GAME CREATED ============");
