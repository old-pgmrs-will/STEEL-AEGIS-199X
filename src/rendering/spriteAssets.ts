export type SpriteLayoutEntry = {
  sheet: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SpriteAssetBundle = {
  images: Map<string, HTMLImageElement>;
  layout: Record<string, SpriteLayoutEntry>;
};

type SheetLayoutModule = {
  default: Record<string, SpriteLayoutEntry>;
};

const SHEET_LAYOUT_MODULES = import.meta.glob("../../assets/sprites/manifests/sheet-layout.json", {
  eager: true
}) as Record<string, SheetLayoutModule>;

const SHEET_IMAGE_MODULES = import.meta.glob("../../assets/sprites/sheets/*.png", {
  eager: true,
  import: "default"
}) as Record<string, string>;

export async function loadSpriteAssets(): Promise<SpriteAssetBundle> {
  const layout = resolveSheetLayout();
  const sheetUrls = resolveSheetUrls();
  const images = new Map<string, HTMLImageElement>();
  const sheetNames = [...new Set(Object.values(layout).map((entry) => entry.sheet))];

  await Promise.all(
    sheetNames.map(async (sheetName) => {
      const url = sheetUrls.get(sheetName);
      if (!url) {
        throw new Error(`スプライトシートが見つかりませんでした: ${sheetName}`);
      }

      const image = await loadImage(url, sheetName);
      images.set(sheetName, image);
    })
  );

  return {
    images,
    layout
  };
}

function resolveSheetLayout(): Record<string, SpriteLayoutEntry> {
  const [module] = Object.values(SHEET_LAYOUT_MODULES);
  if (!module?.default) {
    throw new Error("sheet-layout.json を読み込めませんでした。");
  }
  return module.default;
}

function resolveSheetUrls(): Map<string, string> {
  const urls = new Map<string, string>();

  for (const [modulePath, url] of Object.entries(SHEET_IMAGE_MODULES)) {
    const segments = modulePath.split("/");
    const sheetName = segments[segments.length - 1];
    if (!sheetName) {
      continue;
    }
    urls.set(sheetName, url);
  }

  return urls;
}

function loadImage(src: string, sheetName: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`スプライト画像の読み込みに失敗しました: ${sheetName}`));
    image.src = src;
  });
}
