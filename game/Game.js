import * as THREE from '../../libs/three137/three.module.js';
import { GLTFLoader } from '../../libs/three137/GLTFLoader.js';
import { RGBELoader } from '../../libs/three137/RGBELoader.js';
import { DRACOLoader } from '../../libs/three137/DRACOLoader.js';
import { OrbitControls } from '../../libs/three137/OrbitControls.js';
import { LoadingBar } from '../../libs/LoadingBar.js';
import { Plane } from './Plane.js';
import { Obstacles } from './Obstacles.js';
import { SFX } from '../libs/SFX.js';

class Game {
    constructor() {
        const container = document.createElement('div');
        document.body.appendChild(container);

        this.clock = new THREE.Clock();

        this.assetsPath = '../assets/';

        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.set(-4.37, 0, -4.75);
        this.camera.lookAt(0, 0, 6);

        this.cameraController = new THREE.Object3D();
        this.cameraController.add(this.camera);
        this.cameraTarget = new THREE.Vector3(0, 0, 6);

        this.scene = new THREE.Scene();
        this.scene.add(this.cameraController);

        const ambient = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
        ambient.position.set(0.5, 1, 0.25);
        this.scene.add(ambient);

        this.loadingBar = new LoadingBar();
        this.load();

        document.addEventListener('keydown', this.keyDown.bind(this));
        document.addEventListener('keyup', this.keyUp.bind(this));

        document.addEventListener('touchstart', this.mouseDown.bind(this));
        document.addEventListener('touchend', this.mouseUp.bind(this));
        document.addEventListener('mousedown', this.mouseDown.bind(this));
        document.addEventListener('mouseup', this.mouseUp.bind(this));

        this.spaceKey = false;
        this.active = false;
        const btn = document.getElementById('playBtn');
        btn.addEventListener('click', this.startGame.bind(this));

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        container.appendChild(this.renderer.domElement);
        this.setEnvironment();

        const controls = new OrbitControls(this.camera, this.renderer.domElement);
        controls.target.set(0, 1, 0);
        controls.update();

        this.renderer.setAnimationLoop(this.render.bind(this));

        window.addEventListener('resize', this.resize.bind(this));
    }
    setEnvironment() {
        const loader = new RGBELoader();
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        pmremGenerator.compileEquirectangularShader();

        const self = this;

        loader.load('../assets/hdr/venice_sunset_1k.hdr', (texture) => {
            const envMap = pmremGenerator.fromEquirectangular(texture).texture;
            pmremGenerator.dispose();

            self.scene.environment = envMap;

        }, undefined, (err) => {
            console.error('An error occurred setting the environment');
        });
    }

    load() {
        this.loading = true;
        this.loadingBar.visible = true;

        this.loadSkyBox();
        this.plane = new Plane(this);
        this.obstacles = new Obstacles(this);

        this.loadSFX();
    }

    loadSFX() {
        this.sfx = new SFX(this.camera, `${this.assetsPath}plane/`);
        this.sfx.load('explosion');
        this.sfx.load('engine', true, 1);
        this.sfx.load('gliss')
        this.sfx.load('gameover');
    }

    loadSkyBox() {
        this.scene.background = new THREE.CubeTextureLoader()
            .setPath(`${this.assetsPath}plane/paintedsky/`)
            .load([
                'px.jpg',
                'nx.jpg',
                'py.jpg',
                'ny.jpg',
                'pz.jpg',
                'nz.jpg'
            ], () => {
                this.renderer.setAnimationLoop(this.render.bind(this));
            });
    }
    updateCamera() {
        this.cameraController.position.copy(this.plane.position);
        this.cameraController.position.y = 0;
        this.cameraTarget.copy(this.plane.position);
        this.cameraTarget.z += 6;
        this.camera.lookAt(this.cameraTarget);
    }
    startGame() {
        const gameOver = document.getElementById('gameover');
        const instructions = document.getElementById('instructions');
        const btn = document.getElementById('playBtn');

        gameOver.style.display = 'none';
        instructions.style.display = 'none';
        btn.style.display = 'none';

        this.score = 0;
        this.lives = 3;
        let elm = document.getElementById('score');
        elm.textContent = this.score;

        elm = document.getElementById('lives');
        elm.textContent = this.lives;

        this.plane.reset();
        this.obstacles.reset();
        this.active = true;

        this.sfx.play('engine');
    };
    mouseDown() {
        this.spaceKey = true;
    }
    mouseUp() {
        this.spaceKey = false;
    }
    keyDown(event) {
        switch (event.keyCode) {
            case 32:
                this.spaceKey = true;
                break;
        }
    }
    keyUp(event) {
        switch (event.keyCode) {
            case 32:
                this.spaceKey = false;
                break;
        }
    }

    gameOver() {
        this.active = false;
        const gameOver = document.getElementById('gameover');
        const btn = document.getElementById('playBtn');

        gameOver.style.display = 'block';
        btn.textContent = 'Play Again';
        btn.style.display = 'block';

        this.sfx.stopAll();
        this.sfx.play('gameover');

    }
    incScore() {
        this.sfx.play('gliss');
        this.score++;
        const elm = document.getElementById('score');
        elm.textContent = this.score;
    }
    decLives() {
        this.lives--;
        const elm = document.getElementById('lives');
        elm.textContent = this.lives;
        if (this.lives === 0) return this.gameOver();
        this.sfx.play('explosion');
    }
    reset() {
        this.plane.position.set(0, 0, 0);
        this.velocity.set(0, 0, 0.1);
    }

    resize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    render() {
        if (this.loading) {
            if (this.plane.ready && this.obstacles.ready) {
                this.loading = false;
                this.loadingBar.visible = false;
            } else {
                return;
            }
        }
        const dt = this.clock.getDelta()
        const time = this.clock.getElapsedTime();

        if (this.active) this.obstacles.update(this.plane.position, dt);

        this.plane.update(time);
        this.updateCamera();

        this.renderer.render(this.scene, this.camera);
    }
}

export { Game };
