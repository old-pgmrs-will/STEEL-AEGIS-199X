import "./styles.css";
import { GAME_HEIGHT, GAME_WIDTH } from "./config";
import { Game } from "./game";
import { loadSpriteAssets } from "./rendering/spriteAssets";
import { SpriteSheet } from "./rendering/sprites";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("#app が見つかりませんでした。");
}

const shell = document.createElement("main");
shell.className = "shell";

const frame = document.createElement("section");
frame.className = "frame";

const canvas = document.createElement("canvas");
canvas.width = GAME_WIDTH;
canvas.height = GAME_HEIGHT;
canvas.className = "game-canvas";
canvas.setAttribute("aria-label", "縦スクロールシューティングゲーム");

const aside = document.createElement("aside");
aside.className = "notes";
aside.innerHTML = `
  <h1>STEEL AEGIS 199X</h1>
  <p>初期プレイアブル版</p>
  <ul>
    <li>移動: Arrow / WASD</li>
    <li>ショット: Z / Space</li>
    <li>ボム: X</li>
    <li>低速移動: Shift</li>
    <li>ポーズ: Esc</li>
  </ul>
`;

const status = document.createElement("p");
status.textContent = "スプライト読込中...";
aside.append(status);

frame.append(canvas, aside);
shell.append(frame);
app.append(shell);

let game: Game | null = null;

void bootstrap();

window.addEventListener("beforeunload", () => {
  game?.dispose();
});

async function bootstrap() {
  try {
    const spriteAssets = await loadSpriteAssets();
    game = new Game(canvas, new SpriteSheet(spriteAssets));
    game.start();
    status.textContent = "アセット読込完了";
  } catch (error) {
    console.error(error);
    status.textContent = "アセット読込失敗";

    const detail = document.createElement("p");
    detail.textContent = error instanceof Error ? error.message : "不明なエラー";
    aside.append(detail);
  }
}
