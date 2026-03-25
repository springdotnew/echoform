// ── Types ──────────────────────────────────────────────────

export interface StyledSegment {
  readonly text: string;
  readonly fg?: string;
  readonly bg?: string;
  readonly bold?: boolean;
  readonly italic?: boolean;
  readonly underline?: boolean;
}

export interface StyledLine {
  readonly segments: readonly StyledSegment[];
}

// ── Color palette ──────────────────────────────────────────

const STANDARD_COLORS: readonly string[] = [
  "#000000", "#cc0000", "#00cc00", "#cccc00",
  "#0000cc", "#cc00cc", "#00cccc", "#cccccc",
];

const BRIGHT_COLORS: readonly string[] = [
  "#555555", "#ff5555", "#55ff55", "#ffff55",
  "#5555ff", "#ff55ff", "#55ffff", "#ffffff",
];

const color256Palette: readonly string[] = (() => {
  const p: string[] = [...STANDARD_COLORS, ...BRIGHT_COLORS];
  for (let r = 0; r < 6; r++)
    for (let g = 0; g < 6; g++)
      for (let b = 0; b < 6; b++) {
        const h = (v: number): string => (v === 0 ? 0 : 55 + v * 40).toString(16).padStart(2, "0");
        p.push(`#${h(r)}${h(g)}${h(b)}`);
      }
  for (let i = 0; i < 24; i++) {
    const v = (8 + i * 10).toString(16).padStart(2, "0");
    p.push(`#${v}${v}${v}`);
  }
  return p;
})();

// ── Cell & style types ─────────────────────────────────────

interface CellStyle {
  fg: string | undefined;
  bg: string | undefined;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

interface Cell {
  char: string;
  style: CellStyle;
}

const defaultStyle = (): CellStyle => ({ fg: undefined, bg: undefined, bold: false, italic: false, underline: false });
const emptyCell = (): Cell => ({ char: " ", style: defaultStyle() });
const cloneStyle = (s: CellStyle): CellStyle => ({ ...s });

// ── Terminal buffer ────────────────────────────────────────

const DEFAULT_COLS = 120;
const DEFAULT_ROWS = 200; // scrollback lines

export class TerminalBuffer {
  private grid: Cell[][];
  private cols: number;
  private rows: number;
  private cursorRow = 0;
  private cursorCol = 0;
  private style: CellStyle = defaultStyle();
  private savedCursor: { row: number; col: number } | null = null;

  // Parser state for incomplete escape sequences across chunks
  private partial = "";

  constructor(cols = DEFAULT_COLS, rows = DEFAULT_ROWS) {
    this.cols = cols;
    this.rows = rows;
    this.grid = [this.newRow()];
  }

  resize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
    // Clamp cursor
    if (this.cursorCol >= cols) this.cursorCol = cols - 1;
  }

  private newRow(): Cell[] {
    return Array.from({ length: this.cols }, emptyCell);
  }

  private ensureRow(row: number): void {
    while (this.grid.length <= row) {
      this.grid.push(this.newRow());
    }
  }

  private writeChar(ch: string): void {
    if (this.cursorCol >= this.cols) {
      // Line wrap
      this.cursorCol = 0;
      this.cursorRow++;
    }
    this.ensureRow(this.cursorRow);
    const row = this.grid[this.cursorRow]!;
    // Extend row if needed
    while (row.length <= this.cursorCol) row.push(emptyCell());
    row[this.cursorCol] = { char: ch, style: cloneStyle(this.style) };
    this.cursorCol++;
  }

  // ── Escape sequence processing ───────────────────────────

  write(data: string): void {
    const input = this.partial + data;
    this.partial = "";
    let i = 0;
    const len = input.length;

    while (i < len) {
      const ch = input[i]!;

      // ── Control characters ─────────
      if (ch === "\x1b") {
        // Check if we have enough data for the sequence
        if (i + 1 >= len) { this.partial = input.slice(i); return; }

        const next = input[i + 1]!;

        // CSI: ESC [
        if (next === "[") {
          const end = this.findCsiEnd(input, i + 2);
          if (end === -1) { this.partial = input.slice(i); return; }
          this.processCsi(input.slice(i + 2, end), input[end]!);
          i = end + 1;
          continue;
        }

        // OSC: ESC ]
        if (next === "]") {
          const end = this.findOscEnd(input, i + 2);
          if (end === -1) { this.partial = input.slice(i); return; }
          i = end; // skip entire OSC
          continue;
        }

        // ESC ( X — character set selection (ignore)
        if (next === "(") {
          i += 3; // skip ESC ( X
          continue;
        }

        // ESC ) X — character set G1 (ignore)
        if (next === ")") {
          i += 3;
          continue;
        }

        // ESC 7 — save cursor
        if (next === "7") {
          this.savedCursor = { row: this.cursorRow, col: this.cursorCol };
          i += 2;
          continue;
        }

        // ESC 8 — restore cursor
        if (next === "8") {
          if (this.savedCursor) {
            this.cursorRow = this.savedCursor.row;
            this.cursorCol = this.savedCursor.col;
          }
          i += 2;
          continue;
        }

        // ESC = / ESC > — keypad modes (ignore)
        if (next === "=" || next === ">") {
          i += 2;
          continue;
        }

        // ESC M — reverse index (scroll down)
        if (next === "M") {
          if (this.cursorRow > 0) this.cursorRow--;
          i += 2;
          continue;
        }

        // Unknown ESC sequence — skip 2 chars
        i += 2;
        continue;
      }

      if (ch === "\r") {
        this.cursorCol = 0;
        i++;
        continue;
      }

      if (ch === "\n") {
        this.cursorRow++;
        this.ensureRow(this.cursorRow);
        i++;
        continue;
      }

      if (ch === "\b") {
        if (this.cursorCol > 0) this.cursorCol--;
        i++;
        continue;
      }

      if (ch === "\t") {
        const nextTab = (Math.floor(this.cursorCol / 8) + 1) * 8;
        this.cursorCol = Math.min(nextTab, this.cols - 1);
        i++;
        continue;
      }

      // Skip other C0 control characters
      const code = ch.charCodeAt(0);
      if (code < 0x20 && ch !== "\x1b") {
        i++;
        continue;
      }

      // ── Printable character ────────
      this.writeChar(ch);
      i++;
    }

    // Trim scrollback
    const maxLines = this.rows;
    if (this.grid.length > maxLines * 2) {
      const trim = this.grid.length - maxLines;
      this.grid.splice(0, trim);
      this.cursorRow -= trim;
      if (this.cursorRow < 0) this.cursorRow = 0;
    }
  }

  private findCsiEnd(input: string, start: number): number {
    // CSI params can include digits, semicolons, ?, >, !, space, etc.
    // Terminated by a letter (0x40-0x7E)
    for (let j = start; j < input.length; j++) {
      const c = input.charCodeAt(j);
      if (c >= 0x40 && c <= 0x7e) return j;
    }
    return -1; // incomplete
  }

  private findOscEnd(input: string, start: number): number {
    for (let j = start; j < input.length; j++) {
      // BEL terminates
      if (input[j] === "\x07") return j + 1;
      // ST (ESC \) terminates
      if (input[j] === "\x1b" && j + 1 < input.length && input[j + 1] === "\\") return j + 2;
    }
    return -1; // incomplete
  }

  private processCsi(paramStr: string, command: string): void {
    // Strip leading ? > for DEC private modes
    const isPrivate = paramStr.startsWith("?") || paramStr.startsWith(">");
    const cleanParams = paramStr.replace(/^[?>!]/, "");
    const params = cleanParams === "" ? [] : cleanParams.split(";").map((s) => parseInt(s, 10) || 0);

    // DEC private modes — ignore (bracketed paste, cursor visibility, etc.)
    if (isPrivate) return;

    switch (command) {
      case "m": this.processSgr(params); break;
      case "A": this.cursorRow = Math.max(0, this.cursorRow - (params[0] || 1)); break;
      case "B": this.cursorRow += (params[0] || 1); this.ensureRow(this.cursorRow); break;
      case "C": this.cursorCol = Math.min(this.cols - 1, this.cursorCol + (params[0] || 1)); break;
      case "D": this.cursorCol = Math.max(0, this.cursorCol - (params[0] || 1)); break;
      case "E": this.cursorRow += (params[0] || 1); this.cursorCol = 0; this.ensureRow(this.cursorRow); break;
      case "F": this.cursorRow = Math.max(0, this.cursorRow - (params[0] || 1)); this.cursorCol = 0; break;
      case "G": this.cursorCol = Math.max(0, Math.min(this.cols - 1, (params[0] || 1) - 1)); break;
      case "H": case "f": this.moveCursor(params); break;
      case "J": this.eraseInDisplay(params[0] || 0); break;
      case "K": this.eraseInLine(params[0] || 0); break;
      case "L": this.insertLines(params[0] || 1); break;
      case "M": this.deleteLines(params[0] || 1); break;
      case "P": this.deleteChars(params[0] || 1); break;
      case "@": this.insertChars(params[0] || 1); break;
      case "X": this.eraseChars(params[0] || 1); break;
      case "d": this.cursorRow = Math.max(0, (params[0] || 1) - 1); this.ensureRow(this.cursorRow); break;
      case "s": this.savedCursor = { row: this.cursorRow, col: this.cursorCol }; break;
      case "u": if (this.savedCursor) { this.cursorRow = this.savedCursor.row; this.cursorCol = this.savedCursor.col; } break;
      // SGR substrings, scroll, etc. — ignore
    }
  }

  private moveCursor(params: number[]): void {
    const row = Math.max(0, (params[0] || 1) - 1);
    const col = Math.max(0, Math.min(this.cols - 1, (params[1] || 1) - 1));
    // For a scrollback buffer, H is relative to visible area.
    // We approximate by making it relative to current cursor region.
    this.cursorRow = row;
    this.cursorCol = col;
    this.ensureRow(this.cursorRow);
  }

  private eraseInDisplay(mode: number): void {
    this.ensureRow(this.cursorRow);
    if (mode === 0) {
      // Erase from cursor to end
      this.eraseInLine(0);
      for (let r = this.cursorRow + 1; r < this.grid.length; r++) {
        this.grid[r] = this.newRow();
      }
    } else if (mode === 1) {
      // Erase from start to cursor
      for (let r = 0; r < this.cursorRow; r++) {
        this.grid[r] = this.newRow();
      }
      this.eraseInLine(1);
    } else if (mode === 2 || mode === 3) {
      // Erase entire display
      this.grid = [this.newRow()];
      this.cursorRow = 0;
      this.cursorCol = 0;
    }
  }

  private eraseInLine(mode: number): void {
    this.ensureRow(this.cursorRow);
    const row = this.grid[this.cursorRow]!;
    if (mode === 0) {
      // Erase from cursor to end of line
      for (let c = this.cursorCol; c < row.length; c++) row[c] = emptyCell();
    } else if (mode === 1) {
      // Erase from start to cursor
      for (let c = 0; c <= this.cursorCol && c < row.length; c++) row[c] = emptyCell();
    } else if (mode === 2) {
      // Erase entire line
      this.grid[this.cursorRow] = this.newRow();
    }
  }

  private insertLines(n: number): void {
    for (let i = 0; i < n; i++) {
      this.grid.splice(this.cursorRow, 0, this.newRow());
    }
  }

  private deleteLines(n: number): void {
    this.grid.splice(this.cursorRow, n);
    this.ensureRow(this.cursorRow);
  }

  private deleteChars(n: number): void {
    this.ensureRow(this.cursorRow);
    const row = this.grid[this.cursorRow]!;
    row.splice(this.cursorCol, n);
    while (row.length < this.cols) row.push(emptyCell());
  }

  private insertChars(n: number): void {
    this.ensureRow(this.cursorRow);
    const row = this.grid[this.cursorRow]!;
    const blanks = Array.from({ length: n }, emptyCell);
    row.splice(this.cursorCol, 0, ...blanks);
    row.length = this.cols; // truncate
  }

  private eraseChars(n: number): void {
    this.ensureRow(this.cursorRow);
    const row = this.grid[this.cursorRow]!;
    for (let c = this.cursorCol; c < this.cursorCol + n && c < row.length; c++) {
      row[c] = emptyCell();
    }
  }

  private processSgr(params: number[]): void {
    if (params.length === 0) params = [0];
    let i = 0;
    while (i < params.length) {
      const code = params[i]!;
      if (code === 0) { Object.assign(this.style, defaultStyle()); }
      else if (code === 1) { this.style.bold = true; }
      else if (code === 3) { this.style.italic = true; }
      else if (code === 4) { this.style.underline = true; }
      else if (code === 22) { this.style.bold = false; }
      else if (code === 23) { this.style.italic = false; }
      else if (code === 24) { this.style.underline = false; }
      else if (code >= 30 && code <= 37) { this.style.fg = STANDARD_COLORS[code - 30]; }
      else if (code >= 40 && code <= 47) { this.style.bg = STANDARD_COLORS[code - 40]; }
      else if (code >= 90 && code <= 97) { this.style.fg = BRIGHT_COLORS[code - 90]; }
      else if (code >= 100 && code <= 107) { this.style.bg = BRIGHT_COLORS[code - 100]; }
      else if (code === 39) { this.style.fg = undefined; }
      else if (code === 49) { this.style.bg = undefined; }
      else if (code === 38 || code === 48) {
        const mode = params[i + 1];
        if (mode === 5 && i + 2 < params.length) {
          const n = params[i + 2]!;
          const color = n >= 0 && n < 256 ? color256Palette[n] : undefined;
          if (code === 38) this.style.fg = color; else this.style.bg = color;
          i += 2;
        } else if (mode === 2 && i + 4 < params.length) {
          const r = params[i + 2]!, g = params[i + 3]!, b = params[i + 4]!;
          const color = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
          if (code === 38) this.style.fg = color; else this.style.bg = color;
          i += 4;
        }
      }
      i++;
    }
  }

  // ── Rendering to StyledLines ─────────────────────────────

  getLines(): readonly StyledLine[] {
    const result: StyledLine[] = [];
    // Find last non-empty row
    let lastRow = this.grid.length - 1;
    while (lastRow > 0 && this.isRowEmpty(this.grid[lastRow]!)) lastRow--;

    for (let r = 0; r <= lastRow; r++) {
      const row = this.grid[r]!;
      result.push({ segments: this.rowToSegments(row) });
    }
    return result;
  }

  private isRowEmpty(row: Cell[]): boolean {
    return row.every((cell) => cell.char === " " && !cell.style.fg && !cell.style.bg && !cell.style.bold);
  }

  private rowToSegments(row: Cell[]): StyledSegment[] {
    const segments: StyledSegment[] = [];
    let current = "";
    let currentStyle: CellStyle = defaultStyle();

    // Find last non-space char to trim trailing whitespace
    let lastNonSpace = -1;
    for (let c = row.length - 1; c >= 0; c--) {
      if (row[c]!.char !== " " || row[c]!.style.fg || row[c]!.style.bg || row[c]!.style.bold) {
        lastNonSpace = c;
        break;
      }
    }

    for (let c = 0; c <= lastNonSpace; c++) {
      const cell = row[c] ?? emptyCell();
      const sameStyle = cell.style.fg === currentStyle.fg
        && cell.style.bg === currentStyle.bg
        && cell.style.bold === currentStyle.bold
        && cell.style.italic === currentStyle.italic
        && cell.style.underline === currentStyle.underline;

      if (sameStyle) {
        current += cell.char;
      } else {
        if (current.length > 0) segments.push(makeSegment(current, currentStyle));
        current = cell.char;
        currentStyle = cloneStyle(cell.style);
      }
    }

    if (current.length > 0) segments.push(makeSegment(current, currentStyle));
    return segments;
  }
}

const makeSegment = (text: string, style: CellStyle): StyledSegment => ({
  text,
  ...(style.fg !== undefined && { fg: style.fg }),
  ...(style.bg !== undefined && { bg: style.bg }),
  ...(style.bold && { bold: true }),
  ...(style.italic && { italic: true }),
  ...(style.underline && { underline: true }),
});

// ── Convenience wrappers (backward compat) ─────────────────

export const parseAnsiOutput = (raw: string): readonly StyledLine[] => {
  const buf = new TerminalBuffer();
  buf.write(raw);
  return buf.getLines();
};

export const createDefaultState = (): { fg: undefined; bg: undefined; bold: false; italic: false; underline: false } => ({
  fg: undefined, bg: undefined, bold: false, italic: false, underline: false,
});
