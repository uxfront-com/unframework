// A solid-colour PNG for the command's fake screenshots, encoded with node:zlib: the comparison is
// the testing package's (L10), so this package depends on no image library of its own.
import { crc32, deflateSync, inflateSync } from "node:zlib";

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** A `width`×`height` RGBA PNG of one colour: `red`, then full green, blue and alpha. */
export function png(width: number, height: number, red = 255): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const row = Buffer.alloc(1 + width * 4);
  for (let x = 0; x < width; x += 1) row.set([red, 255, 255, 255], 1 + x * 4);
  const pixels = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** The colour of one pixel of an 8-bit RGB or RGBA PNG, such as a capture: `[r, g, b, a]`. */
export function pixelAt(file: Buffer, x: number, y: number): number[] {
  let offset = 8;
  let width = 0;
  let channels = 0;
  const data: Buffer[] = [];
  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString("ascii", offset + 4, offset + 8);
    const body = file.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      channels = { 2: 3, 6: 4 }[body[9]!] ?? 0;
      if (body[8] !== 8 || !channels || body[12] !== 0) throw new Error("Not an 8-bit RGB(A) PNG.");
    }
    if (type === "IDAT") data.push(body);
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(data));
  const stride = width * channels;
  let previous = Buffer.alloc(stride);
  let row = previous;
  for (let line = 0; line <= y; line += 1) {
    const start = line * (stride + 1);
    const filter = raw[start]!;
    row = Buffer.from(raw.subarray(start + 1, start + 1 + stride));
    for (let index = 0; index < stride; index += 1) {
      const left = index >= channels ? row[index - channels]! : 0;
      const up = previous[index]!;
      const corner = index >= channels ? previous[index - channels]! : 0;
      const paeth = () => {
        const p = left + up - corner;
        const [a, b, c] = [Math.abs(p - left), Math.abs(p - up), Math.abs(p - corner)];
        return a <= b && a <= c ? left : b <= c ? up : corner;
      };
      const add = [0, left, up, (left + up) >> 1, paeth()][filter]!;
      row[index] = (row[index]! + add) & 0xff;
    }
    previous = row;
  }
  const pixel = [...row.subarray(x * channels, x * channels + channels)];
  return channels === 3 ? [...pixel, 255] : pixel;
}
