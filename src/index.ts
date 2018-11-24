type ClipImageOrder = {
  type: "clip";
  options: {
    x: number;
    y: number;
    width: number;
    height: number;
    useDevicePixel?: boolean;
  };
};

type MarkImageOrder = {
  type: "mark";
  options: {
    text: string;
    x: number;
    y: number;
    fontFamily?: string;
    fontSize?: number;
    textBaseline?: CanvasRenderingContext2D["textBaseline"];
    textAlign?: CanvasRenderingContext2D["textAlign"];
    color?: string;
    useDevicePixel?: boolean;
  };
};

type RoundImageOrder = {
  type: "round";
  options: {
    radius: number;
    useDevicePixel?: boolean;
  };
};

type ShadowImageOrder = {
  type: "shadow";
  options: {
    shadowColor?: string;
    shadowBlur?: number;
    shadowOffsetX?: number;
    shadowOffsetY?: number;
    useDevicePixel?: boolean;
  };
};

type BackgroundImageOrder = {
  type: "background";
  options: {
    backgroundColor: string;
  }
};

type ImageOrder = ClipImageOrder | RoundImageOrder | ShadowImageOrder | MarkImageOrder | BackgroundImageOrder;

function createRoundRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {

  const minSize = Math.min(width, height);

  if (radius > minSize / 2) radius = minSize / 2;

  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

export default class CanvasClip {
  private originalURI: string;
  private loadImagePromise: Promise<HTMLImageElement>;
  private execPromise: Promise<void> | null = null;
  private result: HTMLCanvasElement | null = null;
  private orders: ImageOrder[] = [];

  constructor(uri: string) {
    this.originalURI = uri;
    this.loadImagePromise = new Promise((resolve, reject) => {
      const image = new Image();

      image.onload = () => {
        this.result = this.createCanvasFromImage(image);
        resolve(image);
      };

      image.onerror = () => {
        reject();
      };

      image.src = uri;
    });
  }

  addOrder(orders: ImageOrder[] | ImageOrder) {
    if (Array.isArray(orders)) {
      this.orders.push(...orders);
    } else {
      this.orders.push(orders);
    }

    return this;
  }

  exec() {
    this.execPromise = new Promise((resolve, reject) => {
      this.loadImagePromise
        .then(() => {
          const { orders } = this;

          let order;

          while (order = orders.shift()) {
            this.result = this[order.type].call(this, order.options);
          }

          resolve();
        })
        .catch(() => reject());
    });

    return this;
  }

  async getURI() {
    if (!this.execPromise) {
      return this.originalURI;
    }

    await this.execPromise;

    return (this.result as HTMLCanvasElement).toDataURL();
  }

  async getCanvas() {
    if (!this.execPromise) {
      await this.loadImagePromise;
    } else {
      await this.execPromise;
    }

    return this.result;
  }

  private clip({ x, y, width, height, useDevicePixel = true }: ClipImageOrder["options"]) {
    if (useDevicePixel) {
      const { devicePixelRatio: ratio } = window;
      x *= ratio; y *= ratio;
      width *= ratio; height *= ratio;
    }

    const { canvas, context } = this.createCanvas(width, height);

    context.drawImage(this.result as HTMLCanvasElement, -x, -y);

    return canvas;
  }

  private mark({
    text, x, y,
    fontFamily = "sans-serif",
    fontSize = 16,
    textBaseline = "top",
    textAlign = "left",
    color = "#000",
    useDevicePixel = true
  }: MarkImageOrder["options"]) {
    if (useDevicePixel) {
      const { devicePixelRatio: ratio } = window;

      x *= ratio;
      y *= ratio;
      fontSize *= ratio;
    }

    const srcImage = this.result as HTMLCanvasElement;
    const context = this.getContext(srcImage);

    context.font = `${fontSize}px ${fontFamily}`;
    context.textBaseline = textBaseline;
    context.textAlign = textAlign;
    context.fillStyle = color;

    context.fillText(text, x, y);

    return srcImage;
  }

  private round({ radius, useDevicePixel = true }: RoundImageOrder["options"]) {
    if (useDevicePixel) {
      radius *= window.devicePixelRatio;
    }

    const srcImage = this.result as HTMLCanvasElement;
    const { width, height } = srcImage;
    const { canvas, context } = this.createCanvas(width, height);

    createRoundRectPath(context, 0, 0, width, height, radius);
    context.clip();

    context.drawImage(srcImage, 0, 0);

    return canvas;
  }

  private shadow({
    shadowColor = "#666",
    shadowBlur = 10,
    shadowOffsetX = 0,
    shadowOffsetY = 2,
    useDevicePixel = true
  }: ShadowImageOrder["options"]) {
    if (useDevicePixel) {
      const { devicePixelRatio: ratio } = window;

      shadowBlur *= ratio;
      shadowOffsetX *= ratio;
      shadowOffsetY *= ratio;
    }

    const srcImage = this.result as HTMLCanvasElement;
    const { width, height } = srcImage;
    const { canvas, context } = this.createCanvas(width + 2 * shadowBlur, height + 2 * shadowBlur);

    context.shadowColor = shadowColor;
    context.shadowBlur = shadowBlur;
    context.shadowOffsetX = shadowOffsetX;
    context.shadowOffsetY = shadowOffsetY;

    context.drawImage(srcImage, shadowBlur, shadowBlur);

    return canvas;
  }

  private background({ backgroundColor }: BackgroundImageOrder["options"]) {
    const srcImage = this.result as HTMLCanvasElement;
    const { width, height } = srcImage;
    const { canvas, context } = this.createCanvas(width, height);

    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, width, height);
    context.drawImage(srcImage, 0, 0);

    return canvas;
  }

  private createCanvasFromImage(image: HTMLImageElement) {
    const { canvas, context } = this.createCanvas(image.width, image.height);

    context.drawImage(image, 0, 0);

    return canvas;
  }

  private createCanvas(width: number, height: number) {
    const canvas = document.createElement("canvas");
    const context = this.getContext(canvas);

    canvas.width = width;
    canvas.height = height;

    return { canvas, context };
  }

  private getContext(canvas: HTMLCanvasElement) {
    return canvas.getContext("2d") as CanvasRenderingContext2D;
  }
}
