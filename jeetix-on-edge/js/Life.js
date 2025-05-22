const TARGET = 40

export default class Life {
  constructor(x, y, image, frames = 22, frameDuration = 2) {
    this.x = x
    this.y = y

    this.img   = image
    this.srcW  = image.width / frames
    this.srcH  = image.height

    this.width  = TARGET       
    this.height = TARGET       

    this.frames = frames
    this.frameTime = frameDuration

    this.t = 0
    this.f = 0
    this.collected = false     
  }

  draw(c) {
    if (this.collected) return
    c.drawImage(
      this.img,
      this.f * this.srcW, 0,
      this.srcW, this.srcH,
      this.x, this.y,
      this.width, this.height   
    )
  }

  update(dt) {
    if (this.collected) return
    this.t += dt
    if (this.t >= this.frameTime) {
      this.f = (this.f + 1) % this.frames
      this.t -= this.frameTime
    }
  }
}
