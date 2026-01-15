import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";

export class NPC {
  constructor(game, options) {
    const { model, position, rotation, color } = options;
    
    this.game = game;
    this.model = model;
    this.color = color || this.getRandomColor();
    this.animations = game.animations;
    
    // Map FBX model names to texture names (they use different capitalization)
    this.textureModelName = this.getTextureModelName(model);
    
    // Store position and rotation to preserve them for async callback
    this.spawnPosition = { ...position };
    this.spawnRotation = { ...rotation };
    
    const loader = new FBXLoader();
    const npc = this;

    console.log(`Spawning NPC ${model} at position:`, npc.spawnPosition);

    loader.load(`${game.assetsPath}fbx/people/${model}.fbx`, (object) => {
      object.mixer = new THREE.AnimationMixer(object);
      npc.root = object;
      npc.mixer = object.mixer;

      object.name = "NPC";

      object.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      const textureLoader = new THREE.TextureLoader();
      const texturePath = `${game.assetsPath}images/SimplePeople_${npc.textureModelName}_${npc.color}.png`;
      console.log(`Loading texture: ${texturePath}`);
      textureLoader.load(
        texturePath,
        (texture) => {
          // Successfully loaded texture
          object.traverse((child) => {
            if (child.isMesh) {
              child.material.map = texture;
              child.material.needsUpdate = true;
            }
          });
          console.log(`Texture loaded for NPC: ${model}_${npc.color}`);
        },
        undefined, // onProgress
        (error) => {
          // Error loading texture - apply a default color instead
          console.warn(`Failed to load texture for ${model}_${npc.color}, using default material`);
          object.traverse((child) => {
            if (child.isMesh) {
              // Set a basic color material as fallback
              child.material.color.setHex(0x808080); // Gray color
              child.material.needsUpdate = true;
            }
          });
        }
      );

      npc.object = new THREE.Object3D();
      npc.object.position.set(npc.spawnPosition.x, npc.spawnPosition.y, npc.spawnPosition.z);
      npc.object.rotation.set(npc.spawnRotation.x || 0, npc.spawnRotation.y || 0, npc.spawnRotation.z || 0);
      npc.object.add(object);
      npc.object.userData.npc = true;
      
      console.log(`NPC ${model} placed at:`, npc.object.position);
      
      game.scene.add(npc.object);

      // Set initial idle animation
      if (game.animations.Idle !== undefined) {
        npc.setAction("Idle");
      }
    });
  }

  getRandomColor() {
    const colors = ["White", "Black", "Brown"];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  getTextureModelName(fbxName) {
    // Map FBX file names to texture file names
    const nameMap = {
      "Housewife": "HouseWife",
      "Roadworker": "RoadWorker",
      "Streetman": "StreetMan",
      "Trucker": "StreetMan", // Trucker texture doesn't exist, use StreetMan instead
    };
    return nameMap[fbxName] || fbxName;
  }

  setAction(name) {
    if (this.actionName === name || name == undefined) return;

    const animation = this.animations[name];
    if (!animation) return;

    const clip = THREE.AnimationClip.parse(THREE.AnimationClip.toJSON(animation));
    const action = this.mixer.clipAction(clip);
    action.time = 0;

    const fadeDuration = 0.3;

    if (this.currentAction) {
      this.currentAction.fadeOut(fadeDuration);
    }

    action.reset();
    action.setEffectiveTimeScale(1);
    action.setEffectiveWeight(1);
    action.fadeIn(fadeDuration);
    action.play();

    this.currentAction = action;
    this.actionName = name;
  }

  update(dt) {
    if (this.mixer) {
      this.mixer.update(dt);
    }
  }

  dispose() {
    if (this.mixer) {
      this.mixer.stopAllAction();
      if (this.currentAction) {
        this.mixer.uncacheClip(this.currentAction.getClip());
        this.currentAction = null;
      }
      this.mixer.uncacheRoot(this.root);
    }
    if (this.object && this.object.parent) {
      this.game.scene.remove(this.object);
    }
  }
}
