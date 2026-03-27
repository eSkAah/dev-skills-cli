import pc from "picocolors";
import * as clack from "@clack/prompts";

let _verbose = false;
let _quiet = false;

export function setVerbose(value: boolean): void {
  _verbose = value;
}

export function setQuiet(value: boolean): void {
  _quiet = value;
}

export function isVerbose(): boolean {
  return _verbose;
}

export function isQuiet(): boolean {
  return _quiet;
}

export const logger = {
  info(msg: string): void {
    if (_quiet) return;
    console.log(`${pc.blue("i")} ${msg}`);
  },

  success(msg: string): void {
    if (_quiet) return;
    console.log(`${pc.green("\u2714")} ${msg}`);
  },

  warn(msg: string): void {
    console.log(`${pc.yellow("\u26A0")} ${msg}`);
  },

  error(msg: string): void {
    console.error(`${pc.red("\u2718")} ${msg}`);
  },

  debug(msg: string): void {
    if (!_verbose) return;
    console.log(`${pc.gray("[debug]")} ${pc.gray(msg)}`);
  },

  spinner(msg: string): { stop: (finalMsg?: string) => void } {
    const s = clack.spinner();
    s.start(msg);
    return {
      stop(finalMsg?: string) {
        s.stop(finalMsg ?? msg);
      },
    };
  },
};
