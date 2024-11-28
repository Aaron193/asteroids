export class Sprite {
    image: HTMLImageElement;
    width: number = 0;
    height: number = 0;
    halfWidth: number = 0;
    halfHeight: number = 0;
    loaded: boolean = false;

    constructor(path: string) {
        this.image = new Image();
        this.image.src = path;

        this.image.onload = () => {
            this.width = this.image.width;
            this.height = this.image.height;
            this.halfWidth = this.width / 2;
            this.halfHeight = this.height / 2;
            this.loaded = true;
        };
    }

    isLoaded() {
        return this.loaded;
    }
}
