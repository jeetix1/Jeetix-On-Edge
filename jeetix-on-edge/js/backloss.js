export default class Backloss {
  constructor(image, frameWidth, frameHeight, frameCount, frameDuration) {
    this.image = image
    this.frameWidth = frameWidth
    this.frameHeight = frameHeight
    this.frameCount = frameCount
    this.frameDuration = frameDuration
    this.elapsed = 0
    this.currentFrame = 0
  }

  update(deltaTime) {
    this.elapsed += deltaTime
    if (this.elapsed >= this.frameDuration) {
      this.currentFrame = (this.currentFrame + 1) % this.frameCount
      this.elapsed = 0
    }
  }

  draw(ctx) {
    const sx = this.currentFrame * this.frameWidth
    ctx.drawImage(
      this.image,
      sx, 0,
      this.frameWidth, this.frameHeight,
      0, 0,
      ctx.canvas.width, ctx.canvas.height
    )
  }
}