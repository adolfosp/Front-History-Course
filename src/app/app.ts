import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import packageJson from '../../package.json';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements AfterViewInit, OnDestroy {
  @ViewChild('heroCanvas') private heroCanvas?: ElementRef<HTMLCanvasElement>;

  protected title = 'history-course';
  version = packageJson.version;
  private animationFrameId = 0;
  private renderer?: import('three').WebGLRenderer;
  private scene?: import('three').Scene;
  private camera?: import('three').OrthographicCamera;
  private particles?: import('three').Points;
  private particleMaterial?: import('three').PointsMaterial;
  private particleColors?: import('three').BufferAttribute;
  private particlePositions?: import('three').BufferAttribute;
  private readonly particleCount = 420;
  private readonly particleSeeds = Array.from({ length: this.particleCount }, () => ({
    x: Math.random(),
    y: Math.random(),
    z: Math.random(),
  }));
  private resizeObserver?: ResizeObserver;

  constructor(
    private readonly themeService: ThemeService,
    private readonly ngZone: NgZone
  ) {}

  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => {
      this.initHeroCanvas();
    });
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animationFrameId);
    this.resizeObserver?.disconnect();
    this.renderer?.dispose();

    const geometry = this.particles?.geometry;
    const material = this.particles?.material;

    geometry?.dispose();
    if (Array.isArray(material)) {
      material.forEach((item) => item.dispose());
    } else {
      material?.dispose();
    }
  }

  get isDarkTheme(): boolean {
    return this.themeService.isDarkTheme;
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
    this.updateParticleColors();
  }

  private async initHeroCanvas(): Promise<void> {
    const canvas = this.heroCanvas?.nativeElement;
    const container = canvas?.parentElement;

    if (!canvas || !container) {
      return;
    }

    const THREE = await import('three');

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    this.camera.position.z = 10;

    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      canvas,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const positions: number[] = [];
    const colors: number[] = [];
    const darkPalette = [
      new THREE.Color(0xfb8c00),
      new THREE.Color(0xffb74d),
      new THREE.Color(0x8a8a8a),
    ];
    const lightPalette = [
      new THREE.Color(0xb45309),
      new THREE.Color(0xea580c),
      new THREE.Color(0x171717),
    ];
    const initialPalette = this.themeService.isDarkTheme
      ? darkPalette
      : lightPalette;

    for (let index = 0; index < this.particleCount; index++) {
      positions.push(0, 0, 0);

      const color = initialPalette[index % initialPalette.length];
      colors.push(color.r, color.g, color.b);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3)
    );
    this.particlePositions = geometry.getAttribute(
      'position'
    ) as import('three').BufferAttribute;
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.particleColors = geometry.getAttribute(
      'color'
    ) as import('three').BufferAttribute;

    const material = new THREE.PointsMaterial({
      size: this.themeService.isDarkTheme ? 0.145 : 0.19,
      transparent: true,
      opacity: this.themeService.isDarkTheme ? 0.86 : 0.98,
      vertexColors: true,
    });
    this.particleMaterial = material;

    this.particles = new THREE.Points(geometry, material);
    this.scene.add(this.particles);
    this.updateParticleColors();

    const resize = () => {
      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);
      const aspect = width / height;
      const viewHeight = 4;
      const viewWidth = viewHeight * aspect;

      this.renderer?.setSize(width, height, false);
      if (this.camera) {
        this.camera.left = -viewWidth / 2;
        this.camera.right = viewWidth / 2;
        this.camera.top = viewHeight / 2;
        this.camera.bottom = -viewHeight / 2;
        this.camera.updateProjectionMatrix();
      }
      this.updateParticlePositions(viewWidth, viewHeight);
    };

    this.resizeObserver = new ResizeObserver(resize);
    this.resizeObserver.observe(container);
    resize();

    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate);

      if (this.particles) {
        this.particles.rotation.x += 0.00045;
        this.particles.rotation.y += 0.0012;
      }

      if (this.scene && this.camera) {
        this.renderer?.render(this.scene, this.camera);
      }
    };

    animate();
  }

  private updateParticleColors(): void {
    if (!this.particleColors) {
      return;
    }

    const isDarkTheme = this.themeService.isDarkTheme;
    const palette = isDarkTheme
      ? [
          [0xfb / 255, 0x8c / 255, 0x00],
          [0xff / 255, 0xb7 / 255, 0x4d / 255],
          [0x8a / 255, 0x8a / 255, 0x8a / 255],
        ]
      : [
          [0xb4 / 255, 0x53 / 255, 0x09 / 255],
          [0xea / 255, 0x58 / 255, 0x0c / 255],
          [0x17 / 255, 0x17 / 255, 0x17 / 255],
        ];

    for (let index = 0; index < this.particleColors.count; index++) {
      const color = palette[index % palette.length];
      this.particleColors.setXYZ(index, color[0], color[1], color[2]);
    }

    this.particleColors.needsUpdate = true;

    if (this.particleMaterial) {
      this.particleMaterial.size = isDarkTheme ? 0.145 : 0.19;
      this.particleMaterial.opacity = isDarkTheme ? 0.86 : 0.98;
      this.particleMaterial.needsUpdate = true;
    }
  }

  private updateParticlePositions(viewWidth: number, viewHeight: number): void {
    if (!this.particlePositions) {
      return;
    }

    for (let index = 0; index < this.particlePositions.count; index++) {
      const seed = this.particleSeeds[index];
      this.particlePositions.setXYZ(
        index,
        (seed.x - 0.5) * viewWidth * 1.04,
        (seed.y - 0.5) * viewHeight * 1.08,
        (seed.z - 0.5) * 2
      );
    }

    this.particlePositions.needsUpdate = true;
  }
}
