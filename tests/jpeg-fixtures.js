// Real, small JPEG bitstreams for component/color paths, plus a TIFF container writer.
export function flatJpeg(components = 3, transform = 0) {
  const segment = (marker, data) => [
    255,
    marker,
    (data.length + 2) >> 8,
    (data.length + 2) & 255,
    ...data,
  ];
  const frame = [8, 0, 16, 0, 16, components];
  for (let n = 1; n <= components; n++) frame.push(n, 17, 0);
  const dc = [0, 1, ...Array(15).fill(0), 0],
    ac = [16, 1, ...Array(15).fill(0), 0];
  const scan = [components];
  for (let n = 1; n <= components; n++) scan.push(n, 0);
  scan.push(0, 63, 0);
  const adobe =
    components === 4
      ? segment(238, [65, 100, 111, 98, 101, 0, 100, 0, 0, 0, 0, transform])
      : [];
  const entropy = Array(components).fill(0); // Four 8×8 MCUs: DC=0, AC=EOB per component.
  return Buffer.from([
    255,
    216,
    ...adobe,
    ...segment(219, [0, ...Array(64).fill(1)]),
    ...segment(192, frame),
    ...segment(196, [...dc, ...ac]),
    ...segment(218, scan),
    ...entropy,
    255,
    217,
  ]);
}
export function tiffJpeg(
  jpeg,
  width,
  height,
  { compression = 7, components = 3, tiled = false } = {},
) {
  const tags = [
    [256, 4, 1, width],
    [257, 4, 1, height],
    [258, 3, components, 0],
    [259, 3, 1, compression],
    [262, 3, 1, components === 1 ? 1 : 6],
    [277, 3, 1, components],
    [284, 3, 1, 1],
  ];
  if (tiled)
    tags.push(
      [322, 4, 1, width],
      [323, 4, 1, height],
      [324, 4, 1, 0],
      [325, 4, 1, jpeg.length],
    );
  else tags.push([273, 4, 1, 0], [278, 4, 1, height], [279, 4, 1, jpeg.length]);
  if (compression === 6) tags.push([513, 4, 1, 0], [514, 4, 1, jpeg.length]);
  tags.sort((a, b) => a[0] - b[0]);
  const extra = 8 + 2 + tags.length * 12 + 4,
    bitsBytes = components > 2 ? components * 2 : 0,
    dataOffset = extra + bitsBytes;
  const buffer = Buffer.alloc(dataOffset + jpeg.length);
  buffer.write("II");
  buffer.writeUInt16LE(42, 2);
  buffer.writeUInt32LE(8, 4);
  buffer.writeUInt16LE(tags.length, 8);
  for (let i = 0; i < tags.length; i++) {
    const [tag, type, count, raw] = tags[i],
      offset = 10 + i * 12;
    let value = raw;
    if ([273, 324, 513].includes(tag)) value = dataOffset;
    if (tag === 258) value = bitsBytes ? extra : 8;
    buffer.writeUInt16LE(tag, offset);
    buffer.writeUInt16LE(type, offset + 2);
    buffer.writeUInt32LE(count, offset + 4);
    if (type === 3 && count === 1) buffer.writeUInt16LE(value, offset + 8);
    else buffer.writeUInt32LE(value, offset + 8);
  }
  for (let i = 0; i < bitsBytes; i += 2) buffer.writeUInt16LE(8, extra + i);
  jpeg.copy(buffer, dataOffset);
  return buffer;
}
