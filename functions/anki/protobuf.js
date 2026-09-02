/** Minimal protobuf wire decoder for the stable Anki fields consumed here. */

function readVarint(buffer, start) {
  let value = 0n;
  let shift = 0n;
  let offset = start;
  while (offset < buffer.length && shift <= 70n) {
    const byte = BigInt(buffer[offset]);
    offset += 1;
    value |= (byte & 0x7fn) << shift;
    if ((byte & 0x80n) === 0n) return { value, offset };
    shift += 7n;
  }
  throw new Error('Protobuf varint invalido.');
}

function decodeMessage(buffer) {
  const fields = new Map();
  let offset = 0;
  while (offset < buffer.length) {
    const tag = readVarint(buffer, offset);
    offset = tag.offset;
    const fieldNumber = Number(tag.value >> 3n);
    const wireType = Number(tag.value & 7n);
    let value;
    if (wireType === 0) {
      const decoded = readVarint(buffer, offset);
      value = decoded.value;
      offset = decoded.offset;
    } else if (wireType === 1) {
      if (offset + 8 > buffer.length) throw new Error('Campo protobuf truncado.');
      value = buffer.subarray(offset, offset + 8);
      offset += 8;
    } else if (wireType === 2) {
      const length = readVarint(buffer, offset);
      offset = length.offset;
      const size = Number(length.value);
      if (!Number.isSafeInteger(size) || size < 0 || offset + size > buffer.length) {
        throw new Error('Campo protobuf length-delimited invalido.');
      }
      value = buffer.subarray(offset, offset + size);
      offset += size;
    } else if (wireType === 5) {
      if (offset + 4 > buffer.length) throw new Error('Campo protobuf truncado.');
      value = buffer.subarray(offset, offset + 4);
      offset += 4;
    } else {
      throw new Error(`Wire type protobuf nao suportado: ${wireType}.`);
    }
    const list = fields.get(fieldNumber) || [];
    list.push({ wireType, value });
    fields.set(fieldNumber, list);
  }
  return fields;
}

function firstVarint(fields, number, fallback = 0) {
  const item = fields.get(number)?.find((entry) => entry.wireType === 0);
  return item ? Number(item.value) : fallback;
}

function firstString(fields, number, fallback = '') {
  const item = fields.get(number)?.find((entry) => entry.wireType === 2);
  return item ? item.value.toString('utf8') : fallback;
}

module.exports = { decodeMessage, firstString, firstVarint, readVarint };
