export default class Platform {
    constructor(x, y, width, height, image) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.image = image;
    }

    draw(ctx) {
        if (this.image) {
             // Tiling the image if platform is wider than single block
            const blockWidth = 40; // Assuming original block image width
            const blockHeight = 40; // Assuming original block image height
            const numBlocksX = Math.ceil(this.width / blockWidth);
            const numBlocksY = Math.ceil(this.height / blockHeight); // For platforms taller than one blockzzzzzz

            for (let i = 0; i < numBlocksX; i++) {
                for (let j = 0; j < numBlocksY; j++) {
                     ctx.drawImage(
                        this.image, 
                        this.x + i * blockWidth, 
                        this.y + j * blockHeight, 
                        blockWidth, 
                        blockHeight
                    );
                }
            }
        } else {
            ctx.fillStyle = 'green'; // Fallback if image not loaded
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }
}

