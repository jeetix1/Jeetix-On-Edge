export default class Latex {
    constructor(x, y, image, width, height, speed) {
        this.x             = x
        this.y             = y
        this.image         = image
        this.width         = width
        this.height        = height
        this.vx            = speed

        this.walkFrames    = 3
        this.frameDuration = 200
        this.frameTimer    = 0
        this.currentFrame  = 0
        this.frameWidth    = image.width  / this.walkFrames
        this.frameHeight   = image.height
    }

    update(dt, platforms, lavaBlocks, levelWidth) {
        let dx     = this.vx * dt
        let nextX  = this.x + dx

        let probeX = nextX + this.width / 2
        let probeY = this.y + this.height + 1
        let hasGround = platforms.some(p =>
            probeX >= p.x && probeX <= p.x + p.width &&
            probeY >= p.y && probeY <= p.y + p.height
        )
        if (!hasGround) this.vx = -this.vx

        dx      = this.vx * dt
        nextX   = this.x + dx

        let hitPlat = platforms.some(p =>
            nextX < p.x + p.width &&
            nextX + this.width > p.x &&
            this.y  < p.y + p.height &&
            this.y + this.height > p.y
        )
        let hitLava = lavaBlocks.some(l =>
            nextX < l.x + l.width &&
            nextX + this.width > l.x &&
            this.y  < l.y + l.height &&
            this.y + this.height > l.y
        )
        if (nextX <= 0 || nextX + this.width >= levelWidth || hitPlat || hitLava) {
            this.vx = -this.vx
            dx      = this.vx * dt
        }

        this.x += dx

        this.frameTimer += dt * 16
        if (this.frameTimer >= this.frameDuration) {
            this.currentFrame = (this.currentFrame + 1) % this.walkFrames
            this.frameTimer -= this.frameDuration
        }
    }

    draw(ctx) {
        const sx = this.currentFrame * this.frameWidth

        ctx.save()
        if (this.vx < 0) {
            ctx.translate(this.x + this.width, this.y)
            ctx.scale(-1, 1)
        } else {
            ctx.translate(this.x, this.y)
        }

        ctx.drawImage(
            this.image,
            sx, 0, this.frameWidth, this.frameHeight,
            0,  0, this.width,      this.height
        )
        ctx.restore()
    }
}
