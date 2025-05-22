export default class JumpPadBlock {
    constructor(x, y, width, height, image) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.image = image;
        this.isJumpPad = true; // Property to identify this as a jump pad
    }

    draw(ctx) {
        if (this.image) {
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
        } else {
            // Fallback drawing if image not loaded
            ctx.fillStyle = 'yellow';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }
}