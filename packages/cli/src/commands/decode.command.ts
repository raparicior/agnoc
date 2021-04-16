import { createReadStream } from "fs";
import { Duplex, pipeline, Transform } from "stream";
import { Packet } from "@agnoc/core/value-objects/packet.value-object";
import { ArrayTransform } from "@agnoc/cli/streams/array-transform.stream";
import { PacketDecodeTransform } from "@agnoc/cli/streams/packet-decode-transform.stream";
import { isObject } from "@agnoc/core/utils/is-object.util";
import { OPDecoderLiteral } from "@agnoc/core/constants/opcodes.constant";

interface DecodeOptions {
  json: true | undefined;
  stdin: Duplex;
  stdout: Duplex;
  stderr: Duplex;
}

function filterProperties(_: string, value: unknown) {
  if (isObject(value) && value.type === "Buffer") {
    return "[Buffer]";
  }

  return value;
}

function toJSONStream() {
  return [
    new ArrayTransform(),
    new Transform({
      objectMode: true,
      transform(array: Packet<OPDecoderLiteral>[], _, done) {
        const list = array.map((packet) => packet.toJSON());

        this.push(JSON.stringify(list, filterProperties, 2));
        done();
      },
    }),
  ];
}

function toStringStream() {
  return [
    new Transform({
      objectMode: true,
      transform(packet: Packet<OPDecoderLiteral>, _, done) {
        this.push(packet.toString() + "\n");
        done();
      },
    }),
  ];
}

export function decode(file: string, options: DecodeOptions): void {
  pipeline(
    file === "-" ? options.stdin : createReadStream(file),
    new PacketDecodeTransform(),
    ...(options.json ? toJSONStream() : toStringStream()),
    options.stdout,
    (err) => {
      if (err && err.stack) {
        options.stderr.write(err.stack);
      }
    }
  );
}
