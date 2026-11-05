import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { connect } from "node:net";
import { join } from "node:path";

/** The host every dev server binds to, so that the check below looks in the right place. */
export const HOST = "127.0.0.1";

// Each server takes a free port from the system, so that a run never collides with another
// process, and leaves its number here for the global teardown.
const ledger = (work: string): string => join(work, ".ports");

export function recordPort(work: string, port: number): void {
  mkdirSync(ledger(work), { recursive: true });
  writeFileSync(join(ledger(work), String(port)), "");
}

export function recordedPorts(work: string): number[] {
  return existsSync(ledger(work)) ? readdirSync(ledger(work)).map(Number) : [];
}

export function clearPorts(work: string): void {
  rmSync(ledger(work), { recursive: true, force: true });
}

function isListening(port: number): Promise<boolean> {
  return new Promise((done) => {
    const socket = connect({ host: HOST, port });
    socket.once("connect", () => {
      socket.destroy();
      done(true);
    });
    socket.once("error", () => done(false));
  });
}

/** The ports in the list that something still listens on. */
export async function stillListening(ports: number[]): Promise<number[]> {
  const open = await Promise.all(ports.map(isListening));
  return ports.filter((_, index) => open[index]);
}
