const ACTION_MAP = {
  up: ["ArrowUp", "KeyW"],
  down: ["ArrowDown", "KeyS"],
  left: ["ArrowLeft", "KeyA"],
  right: ["ArrowRight", "KeyD"],
  shot: ["KeyZ", "Space"],
  bomb: ["KeyX"],
  focus: ["ShiftLeft", "ShiftRight"],
  pause: ["Escape"],
  confirm: ["Enter"]
} as const;

type Action = keyof typeof ACTION_MAP;

export class InputController {
  private pressedKeys = new Set<string>();
  private triggeredActions = new Set<Action>();

  constructor(target: Window) {
    target.addEventListener("keydown", (event) => {
      if (event.repeat) {
        return;
      }

      this.pressedKeys.add(event.code);

      for (const [action, codes] of Object.entries(ACTION_MAP) as [Action, ReadonlyArray<string>][]) {
        if (codes.includes(event.code)) {
          this.triggeredActions.add(action);
        }
      }
    });

    target.addEventListener("keyup", (event) => {
      this.pressedKeys.delete(event.code);
    });

    target.addEventListener("blur", () => {
      this.pressedKeys.clear();
      this.triggeredActions.clear();
    });
  }

  isDown(action: Action): boolean {
    return ACTION_MAP[action].some((code) => this.pressedKeys.has(code));
  }

  consume(action: Action): boolean {
    const exists = this.triggeredActions.has(action);
    this.triggeredActions.delete(action);
    return exists;
  }

  endFrame(): void {
    this.triggeredActions.clear();
  }
}
