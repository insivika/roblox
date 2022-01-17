import * as THREE from "three";
import { TextureLoader, WebGLMultipleRenderTargets } from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import io from "socket.io-client";

class Player {
  constructor(game, options) {
    this.local = true;
    let model, color;

    const colors = ["White", "Black", "Brown"];
    const color = colors[Math.floor(Math.random() * color.length)];

    if (options === undefined) {
      const people = [
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
        "Waitress",
      ];
      model = people[Math.floor(Math.random()) * people.length];
    } else if (typeof options == "object") {
      this.local = false;
      this.options = options;
      this.id = options.id;
      model = options.model;
      color = options.color;
    } else {
      // TODO: ???
      model = options;
    }
    this.model = model;
    this.color = color;
    this.game = game;
    this.animations = this.game.animations;

    const loader = new FBXLoader();
    const player = this;

    loader.load(`${game.assetPath}fbx/people/${model}.fbx`, (object) => {
      object.mixer = new THREE.AnimationMixer(object);
      player.root = object;
      player.mixer = object.mixer;

      object.name = "Person";

      object.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      const textureLoader = new THREE.TextureLoader();

      textureLoader.load(
        `${game.assetPath}images/SimplePeople_${model}_${color}.png`,
        (texture) => {
          object.traverse((child) => {
            if (child.isMesh) {
              child.material.map = texture;
            }
          });
        }
      );

      player.object = new THREE.Object3D();
      player.object.position.set(3122, 0, -173);
      player.object.rotation.set(0, 2.6, 0);

      player.object.add(object);

      if (player.deleted === undefined) {
        game.scene.add(player.object);
      }

      if (player.local) {
        game.createCameras();
        game.sun.target = game.player.object;
        game.animations.Idle = object.animations[0];
        if (player.initSocket !== undefined) {
          player.initSocket();
        }
      } else {
        //   Create Colider for Other players
        const geometry = new THREE.BoxGeometry(100, 300, 100);
        const material = new THREE.MeshBasicMaterial({ visible: false });
        const box = new THREE.Mesh(geometry, material);
        box.name = "Collider";
        box.position.set(0, 150, 0);
        player.object.add(box);
        player.collider = box;
        player.object.userData.id = player.id;
        player.object.userData.remotePlayer = true;
        const players = game.initialisingPlayers.splice(
          game.initialisingPlayers.indexOf(this),
          1
        );
        game.remotePlayers.push(players[0]);
      }

      if (game.animations.Idle != undefined) {
        player.action = "Idle";
      }
    });
  }

  setAction(name) {
    if (this.actionName === undefined) return;
    const clip = this.local
      ? this.animations[name]
      : THREE.AnimationClip.parse(
          THREE.AnimationClip.toJSON(this.animations[name])
        );
    const action = this.mixer.clipAction(clip);
    action.time = 0;
    this.mixer.stopAllAction();
    this.actionName = name;
    this.actionTime = Date.now();
    // TODO: Not working in newer Three.js versions
    // action.fadeIn(0.5);
    action.play();
  }

  getAction() {
    return this.action.name;
  }

  update(dt) {
    this.mixer.update(dt);

    if (this.game.remoteData.length > 0) {
      let found = false;
      for (let data of this.game.remoteData) {
        if (data.id != this.id) continue;

        this.object.position.set(data.x, data.y, data.z);
        const euler = new THREE.Euler(data.pb, data.heading, data.pb);
        // TODO: what does this do?
        this.object.quaternion.setFromEuler(euler);
        this.action = data.action;
        found = true;
      }
      if (!found) this.game.removePlayer(this);
    }
  }
}

class PlayerLocal extends Player {
  constructor(game, model) {
    super(game, model);

    const player = this;
    const socket = io();
    socket.on("setId", (data) => {
      player.id = data.id;
    });
    socket.on("remoteData", (data) => {
      game.remoteData = data;
    });

    socket.on("deletePlayer", (data) => {
      const players = game.remotePlayers.filter((player) => {
        if ((player.id = data.id)) {
          return player;
        }
      });

      if (player.length > 0) {
        let index = game.remotePlayers.indexOf(players[0]);
        if (index != -1) {
          game.remotePlayers.splice(index, 1);
          game.scene.remove(players[0].object);
        } else {
          index = game.initialisingPlayers.indexOf(data.id);

          if (index != -1) {
            const player = game.initialisingPlayers[index];
            player.delete = true;
            game.initialisingPlayers.splice(index, 1);
          }
        }
      }
    });
  }

  initSocket() {
    this.socket.emit("init", {
      model: this.model,
      color: this.color,
      x: this.object.position.x,
      y: this.object.position.y,
      z: this.object.position.z,
      h: this.object.rotation.y,
      pb: this.object.rotation.x,
    });
  }

  updateSocket() {
    if (this.socket !== undefined) {
      this.socket.emit("update", {
        x: this.object.position.x,
        y: this.object.position.y,
        z: this.object.position.z,
        h: this.object.rotation.y,
        pb: this.object.rotation.x,
        action: this.action,
      });
    }
  }

  move = (dt) => {
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

    this.updateSocket();
  };
}
