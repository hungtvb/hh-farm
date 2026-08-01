import Phaser from 'phaser';

export class FarmScene extends Phaser.Scene {
  public constructor() {
    super('farm');
  }

  public create(): void {
    const { width, height } = this.scale;
    const graphics = this.add.graphics();

    graphics.fillStyle(0xa8d98c, 1);
    graphics.fillRect(0, 0, width, height);

    graphics.fillStyle(0xc99864, 1);
    graphics.fillRoundedRect(width / 2 - 210, height / 2 - 105, 420, 210, 24);

    graphics.lineStyle(4, 0x8c6548, 1);
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 6; column += 1) {
        graphics.strokeRoundedRect(
          width / 2 - 180 + column * 60,
          height / 2 - 70 + row * 60,
          48,
          48,
          10,
        );
      }
    }

    this.add
      .text(width / 2, 66, 'HH Farm', {
        color: '#244a26',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '42px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height - 48, 'Technical spike · FarmScene is running', {
        color: '#355f36',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
      })
      .setOrigin(0.5);
  }
}
