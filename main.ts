// bounty tiny-stack-vm-01-run-20261122
// Runs a tiny stack VM over 40 instances and writes outputs.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";

const M0 = 65535, SMAX = 256, CMAX = 64, STEP = 1000000, OMAX = 65536, MEM = 256;
const IM = { PUSH8: 1, PUSH32: 4, JMP: 2, JZ: 2, JNZ: 2, CALL: 2 };

function run(prog: Uint8Array, inp: Uint8Array): { out: Uint8Array; exit: number } {
  const st: Int32Array = new Int32Array(SMAX);
  const cs: Int32Array = new Int32Array(CMAX);
  const mem: Int32Array = new Int32Array(MEM);
  const out: Uint8Array = new Uint8Array(OMAX);
  let pc = 0, oi = 0, steps = 0, exit = -1, sp = 0, cp = 0, oc = 0;
  const imm8 = () => { const b = prog[pc + 1]; return b > 127 ? b - 256 : b; };
  const immS16 = () => { const v = prog[pc + 1] | (prog[pc + 2] << 8); return v > 32767 ? v - 65536 : v; };
  const immU16 = () => prog[pc + 1] | (prog[pc + 2] << 8);
  const immS32 = () => (prog[pc + 4] << 24 | prog[pc + 3] << 16 | prog[pc + 2] << 8 | prog[pc + 1]) | 0;
  const pop = (): number => { if (sp === 0) { exit = 2; return 0; } return st[--sp]; };
  const push = (v: number): void => { if (sp === SMAX) { exit = 3; return; } st[sp++] = v | 0; };
  const pop2 = (): [number, number] => { if (sp < 2) { sp = 0; exit = 2; return [0, 0]; } const b = st[--sp]; const a = st[--sp]; return [a, b]; };
  const pop3 = (): [number, number, number] => { if (sp < 3) { sp = 0; exit = 2; return [0, 0, 0]; } const c = st[--sp]; const b = st[--sp]; const a = st[--sp]; return [a, b, c]; };
  const RET = false; const ZEB = false; const XEB = false;
  while (true) {
    if (steps++ >= STEP) { exit = 10; break; }
    if (pc < 0 || pc >= prog.length) { exit = 9; break; }
    const op = prog[pc];
    let ns = pc + 1;
    if (op === 1) ns += 1; else if (op === 2) ns += 4; else if (op >= 0x30 && op <= 0x33) ns += 2;
    if (ns > prog.length) { exit = 9; break; }
    if (op < 0x00 || op > 0x07) {
      if (op < 0x10 || op > 0x1e) {
        if (op < 0x20 || op > 0x22) {
          if (op < 0x30 || op > 0x34) {
            if (op < 0x40 || op > 0x41) {
              if (op < 0x50 || op > 0x53) { exit = 5; break; }
            }
          }
        }
      }
    }
    const cont = true;
    let haltCode = 0;
    switch (op) {
      case 0: exit = 0; break;
      case 1: push(imm8()); break;
      case 2: push(immS32()); break;
      case 3: pop(); break;
      case 4: { const v = pop(); if (exit < 0) { push(v); push(v); } break; }
      case 5: { const [a, b] = pop2(); if (exit < 0) { push(b); push(a); } break; }
      case 6: { const [a, b] = pop2(); if (exit < 0) { push(a); push(b); push(a); } break; }
      case 7: { const [a, b, c] = pop3(); if (exit < 0) { push(b); push(c); push(a); } break; }
      case 0x10: { const [a, b] = pop2(); if (exit < 0) push(a + b); break; }
      case 0x11: { const [a, b] = pop2(); if (exit < 0) push(a - b); break; }
      case 0x12: { const [a, b] = pop2(); if (exit < 0) push(Math.imul(a, b)); break; }
      case 0x13: { const [a, b] = pop2(); if (exit < 0) { if (b === 0) { exit = 4; } else if (a === 0x80000000 | 0 && b === -1) { push(-2147483648); } else { push(Math.trunc(a / b)); } } break; }
      case 0x14: { const [a, b] = pop2(); if (exit < 0) { if (b === 0) { exit = 4; } else if (b === -1) { push(0); } else { push(a - Math.trunc(a / b) * b); } } break; }
      case 0x15: { const [a, b] = pop2(); if (exit < 0) { const ua = a >>> 0; const ub = b >>> 0; if (ub === 0) { exit = 4; } else { push(Math.floor(ua / ub)); } } break; }
      case 0x16: { const [a, b] = pop2(); if (exit < 0) { const ua = a >>> 0; const ub = b >>> 0; if (ub === 0) { exit = 4; } else { push(ua % ub); } } break; }
      case 0x17: { const v = pop(); if (exit < 0) push(v === -2147483648 ? v : -v); break; }
      case 0x18: { const [a, b] = pop2(); if (exit < 0) push(a & b); break; }
      case 0x19: { const [a, b] = pop2(); if (exit < 0) push(a | b); break; }
      case 0x1a: { const [a, b] = pop2(); if (exit < 0) push(a ^ b); break; }
      case 0x1b: { const v = pop(); if (exit < 0) push(~v); break; }
      case 0x1c: { const [a, b] = pop2(); if (exit < 0) push(a << (b & 31)); break; }
      case 0x1d: { const [a, b] = pop2(); if (exit < 0) push(a >> (b & 31)); break; }
      case 0x1e: { const [a, b] = pop2(); if (exit < 0) push(a >>> (b & 31)); break; }
      case 0x20: { const [a, b] = pop2(); if (exit < 0) push(a === b ? 1 : 0); break; }
      case 0x21: { const [a, b] = pop2(); if (exit < 0) push(a < b ? 1 : 0); break; }
      case 0x22: { const [a, b] = pop2(); if (exit < 0) push((a >>> 0) < (b >>> 0) ? 1 : 0); break; }
      case 0x30: pc = ns + immS16(); break;
      case 0x31: { const v = pop(); if (exit < 0) { if (v === 0) pc = ns + immS16(); else pc = ns; } break; }
      case 0x32: { const v = pop(); if (exit < 0) { if (v !== 0) pc = ns + immS16(); else pc = ns; } break; }
      case 0x33: if (cp === CMAX) { exit = 7; } else { cs[cp++] = ns; pc = immU16(); } break;
      case 0x34: if (cp === 0) { exit = 8; } else { pc = cs[--cp]; } break;
      case 0x40: { const ad = pop(); if (exit < 0) { if (ad < 0 || ad > 255) { exit = 6; } else { push(mem[ad]); } } break; }
      case 0x41: { const [v, ad] = pop2(); if (exit < 0) { if (ad < 0 || ad > 255) { exit = 6; } else { mem[ad] = v; } } break; }
      case 0x50: { const v = pop(); if (exit < 0) { let s = v < 0 ? '-' + (-v) : String(v >>> 0); if (oc + s.length > OMAX) { exit = 11; } else { for (let i = 0; i < s.length; i++) { out[oc++] = s.charCodeAt(i); } } } break; }
      case 0x51: { const v = pop(); if (exit < 0) { if (oc >= OMAX) { exit = 11; } else { out[oc++] = v & 255; } } break; }
      case 0x52: push(oi < inp.length ? inp[oi++] : -1); break;
      case 0x53: { const v = pop(); if (exit < 0) { exit = v & 255; } break; }
    }
    if (exit >= 0) break;
    if (op !== 0x30 && op !== 0x31 && op !== 0x32 && op !== 0x33 && op !== 0x34 && op !== 0) pc = ns;
  }
  return { out: out.slice(0, oc), exit: exit < 0 ? 0 : exit };
}

const inpDir = process.env.MAKEFUN_INPUT_DIR || "/input";
const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
for (let i = 1; i <= 40; i++) {
  const id = "i" + String(i).padStart(3, "0");
  const pdir = outDir + "/" + id;
  mkdirSync(pdir, { recursive: true });
  let prog = new Uint8Array(0);
  try { prog = new Uint8Array(readFileSync(inpDir + "/" + id + "/program.bin")); } catch(e) {}
  let input = new Uint8Array(0);
  try { input = new Uint8Array(readFileSync(inpDir + "/" + id + "/input.bin")); } catch(e) {}
  const res = run(prog, input);
  writeFileSync(pdir + "/stdout.bin", Buffer.from(res.out));
  writeFileSync(pdir + "/exit.txt", String(res.exit) + "\n");
}
