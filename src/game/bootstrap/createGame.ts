import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { CropBenchmarkScene } from '../scenes/CropBenchmarkScene';
import { FarmScene } from '../scenes/FarmScene';
import { PreloadScene } from '../scenes/PreloadScene';
import {
  FARM_GAME_RUNTIME_REGISTRY_KEY,
  type FarmGameRuntime,
} from '../runtime/farmGameRuntime';

const GAME_WIDTH = 640;
const GAME_HEIGHT = 360;

export function createGame(
  parent: string | HTMLElement,
  farmRuntime: FarmGameRuntime,
): Phaser.Game {
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
    callbacks: {
      preBoot: (game: Phaser.Game) => {
        game.registry.set(FARM_GAME_RUNTIME_REGISTRY_KEY, farmRuntime);
      },
    },
  });
}
