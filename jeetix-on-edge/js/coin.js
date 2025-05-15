export default class Coin {
    /**
     * @param {number} x      world x
     * @param {number} y      world y
     * @param {number} w      draw width
     * @param {number} h      draw height
     * @param {HTMLImageElement} image  your coin_sprites.png
     * @param {number} frameCount      number of frames in the sheet
     * @param {number} frameDuration   ms per frame
     */
    constructor(x, y, width, height, image, frameCount = 11, frameDuration = 10) {
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
      this.image = image;
      this.frames = frameCount;
      this.frameTime = frameDuration;
      this.timer = 0;
      this.current = 0;
      this.collected = false;
    }
    draw(ctx) {
      if (this.collected || !this.image) return;
      ctx.drawImage(this.image, this.current * this.width, 0, this.width, this.height, this.x, this.y, this.width, this.height);
    }
  
    update(deltaTime) {
      if (this.collected) return;
      this.timer += deltaTime;
      if (this.timer >= this.frameTime) {
        this.current = (this.current + 1) % this.frames;
        this.timer -= this.frameTime;
      }
    }
}
  