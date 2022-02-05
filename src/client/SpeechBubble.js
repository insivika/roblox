import * as THREE from "three";
import { TextureLoader, WebGLMultipleRenderTargets } from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import io from "socket.io-client";

class SpeechBubble {
  constructor(game, msg, size = 1) {
    this.config = {
      font: "Calibri",
      size: 24,
      padding: 10,
      color: "#222",
      width: 256,
      height: 256,
    };

    const planeGeometry = new THREE.PlaneGeometry(size, size);
    const planeMaterial = new THREE.MeshBasicMaterial();
    this.mesh = new THREE.Mesh(planeGeometry, planeMaterial);
    game.scene.add(this.mesh);

    const self = this;
    const loader = new THREE.TextureLoader();
    loader.load(
      `${game.assetsPath}images/speech.png`,
      (texture) => {
        self.img = texture.image;
        self.mesh.material.map = texture;
        self.mesh.material.transparent = true;
        self.mesh.material.needsUpdate = true;
        if (msg !== undefined) self.update(msg);
      },

      undefined,
      (err) => {
        console.log("An error happened");
      }
    );
  }

  update = (msg) => {
    if (this.mesh === undefined) return;

    let context = this.context;

    if (this.mesh.userData.context === undefined) {
      const canvas = this.createOffScreenCanvas(
        this.config.width,
        this.config.height
      );
      this.context = canvas.getContext("2d");
      context = this.context;
      context.font = `${this.config.size}pt ${this.config.font}`;
      context.fillStyle = this.config.color;
      context.textAlign = "center";
      this.mesh.material.map = new THREE.CanvasTexture(canvas);
    }

    const bg = this.img;
    context.clearRect(0, 0, this.config.width, this.config.height);
    context.drawImage(
      // image
      bg,
      // source x
      0,
      // source y
      0,
      // source w
      bg.width,
      // source h
      bg.height,
      // destination x
      0,
      // destination y
      0,
      // destination w
      this.config.width,
      // destination h
      this.config.height
    );

    this.wrapText(msg, context);

    this.mesh.material.map.needsUpdate = true;
  };

  createOffScreenCanvas = (width, height) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  };

  wrapText = (text, context) => {
    const words = text.split(" ");
    let line = "";
    const lines = [];
    const maxWidth = this.config.width - 2 * this.config.padding;
    const lineHeight = this.config.size + 8;

    words.forEach((word) => {
      const testLine = `${line}${word} `;
      const metrics = context.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth) {
        lines.push(line);
        line = `${word} `;
      } else {
        line = testLine;
      }
    });

    if (line != "") lines.push(line);

    let y = (this.config.height - lines.length * lineHeight) / 2;

    lines.forEach((line) => {
      context.fillText(line, 128, y);
      y += lineHeight;
    });
  };

  show = () => {
    if (this.mesh !== undefined && this.player !== undefined) {
      this.mesh.position.set(
        this.player.object.position.x,
        this.player.object.position.y + 380,
        this.player.object.position.z
      );

      this.mesh.lookAt(pos);
    }
  };
}

export default SpeechBubble;
