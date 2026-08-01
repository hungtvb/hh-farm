import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { CropBenchmarkScene } from '../scenes/CropBenchmarkScene';
import { FarmScene } from '../scenes/FarmScene';
import { PreloadScene } from '../scenes/PreloadScene';

const GAME_WIDTH = 640;
const GAME_HEIGHT = 360;

export function createGame(parent: string | HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#a8d98c',
    scene: [BootScene, PreloadScene, FarmScene, CropBenchmarkScene],
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    },
    render: {
      antialias: true,
      roundPixels: true,
    },
    audio: {
      disableWebAudio: false,
    },
  });
}
