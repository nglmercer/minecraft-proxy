import { describe, expect, test } from 'bun:test';
import { readVarIntSync, writeVarIntSync, varIntLength } from '../../src/core/varint.js';

describe('VarInt', () => {
  test('readVarIntSync - single byte', () => {
    const buffer = new Uint8Array([0x00]);
    const result = readVarIntSync(buffer, 0);
    expect(result.value).toBe(0);
    expect(result.offset).toBe(1);
  });

  test('readVarIntSync - two bytes', () => {
    const buffer = new Uint8Array([0x80, 0x01]);
    const result = readVarIntSync(buffer, 0);
    expect(result.value).toBe(128);
    expect(result.offset).toBe(2);
  });

  test('readVarIntSync - three bytes', () => {
    const buffer = new Uint8Array([0x80, 0x80, 0x01]);
    const result = readVarIntSync(buffer, 0);
    expect(result.value).toBe(16384);
    expect(result.offset).toBe(3);
  });

  test('readVarIntSync - max value with 5 bytes', () => {
    const buffer = new Uint8Array([0xff, 0xff, 0xff, 0xff, 0x07]);
    const result = readVarIntSync(buffer, 0);
    expect(result.value).toBe(2147483647);
    expect(result.offset).toBe(5);
  });

  test('writeVarIntSync - single byte', () => {
    const buffer = new Uint8Array(5);
    const offset = writeVarIntSync(buffer, 0, 0);
    expect(offset).toBe(1);
    expect(buffer.slice(0, offset)).toEqual(new Uint8Array([0x00]));
  });

  test('writeVarIntSync - two bytes', () => {
    const buffer = new Uint8Array(5);
    const offset = writeVarIntSync(buffer, 128, 0);
    expect(offset).toBe(2);
    expect(buffer.slice(0, offset)).toEqual(new Uint8Array([0x80, 0x01]));
  });

  test('writeVarIntSync - round trip', () => {
    const values = [0, 1, 2, 127, 128, 255, 256, 1000, 10000, 100000, 1000000, 2147483647];
    for (const value of values) {
      const buffer = new Uint8Array(10);
      const offset = writeVarIntSync(buffer, value, 0);
      const result = readVarIntSync(buffer, 0);
      expect(result.value).toBe(value);
      expect(result.offset).toBe(offset);
    }
  });

  test('varIntLength', () => {
    expect(varIntLength(0)).toBe(1);
    expect(varIntLength(127)).toBe(1);
    expect(varIntLength(128)).toBe(2);
    expect(varIntLength(16383)).toBe(2);
    expect(varIntLength(16384)).toBe(3);
    expect(varIntLength(2097151)).toBe(3);
    expect(varIntLength(2097152)).toBe(4);
    expect(varIntLength(268435455)).toBe(4);
    expect(varIntLength(268435456)).toBe(5);
    expect(varIntLength(2147483647)).toBe(5);
  });
});
