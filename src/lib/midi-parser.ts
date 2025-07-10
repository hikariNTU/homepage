/**
 * Interface for the Time Division property in the MIDI Header.
 */
export interface TimeDivision {
  raw: number;
  ticksPerBeat: number | null;
  framesPerSecond: number | null;
  ticksPerFrame: number | null;
}

/**
 * Interface for the parsed MIDI Header Chunk.
 */
export interface MidiHeader {
  chunkType: string;
  chunkSize: number;
  format: number;
  numTracks: number;
  timeDivision: TimeDivision;
}

/**
 * Base interface for all MIDI events.
 */
export interface MidiEvent {
  deltaTime: number;
  type: string;
  channel?: number; // Optional as not all events have a channel
  status?: number; // For system common/unknown events
  data?: Uint8Array; // For sysex, system common, and raw meta data
}

/**
 * Interface for Note On/Off events.
 */
export interface NoteEvent extends MidiEvent {
  type: "noteOn" | "noteOff";
  noteNumber: number;
  velocity: number;
}

/**
 * Interface for Polyphonic Aftertouch events.
 */
export interface PolyphonicAftertouchEvent extends MidiEvent {
  type: "polyphonicAftertouch";
  noteNumber: number;
  pressure: number;
}

/**
 * Interface for Control Change events.
 */
export interface ControlChangeEvent extends MidiEvent {
  type: "controlChange";
  controllerNumber: number;
  value: number;
}

/**
 * Interface for Program Change events.
 */
export interface ProgramChangeEvent extends MidiEvent {
  type: "programChange";
  programNumber: number;
}

/**
 * Interface for Channel Aftertouch events.
 */
export interface ChannelAftertouchEvent extends MidiEvent {
  type: "channelAftertouch";
  pressure: number;
}

/**
 * Interface for Pitch Bend events.
 */
export interface PitchBendEvent extends MidiEvent {
  type: "pitchBend";
  value: number;
}

/**
 * Interface for Meta events.
 */
export interface MetaEvent extends MidiEvent {
  type: "meta";
  metaType: number;
  metaTypeName: string;
  length: number;
  data: Uint8Array;
  value: string | number | object | Uint8Array; // Can be string, number, or object depending on metaType
}

/**
 * Interface for System Exclusive events.
 */
export interface SysexEvent extends MidiEvent {
  type: "sysex";
  data: Uint8Array;
}

/**
 * Interface for System Common events.
 */
export interface SystemCommonEvent extends MidiEvent {
  type: "systemCommon";
  status: number;
  data: Uint8Array;
}

/**
 * Interface for an unknown event type.
 */
export interface UnknownEvent extends MidiEvent {
  type: "unknown";
  status: number;
  data: Uint8Array;
}

/**
 * Type alias for all possible MIDI events.
 */
export type AnyMidiEvent =
  | NoteEvent
  | PolyphonicAftertouchEvent
  | ControlChangeEvent
  | ProgramChangeEvent
  | ChannelAftertouchEvent
  | PitchBendEvent
  | MetaEvent
  | SysexEvent
  | SystemCommonEvent
  | UnknownEvent;

/**
 * Interface for a parsed MIDI Track Chunk.
 */
export interface MidiTrack {
  chunkType: string;
  chunkSize: number;
  events: AnyMidiEvent[];
}

/**
 * Interface for the complete parsed MIDI data structure.
 */
export interface ParsedMidiData {
  header: MidiHeader;
  tracks: MidiTrack[];
}

/**
 * MidiParser Class
 * Parses a MIDI file (ArrayBuffer) into a structured JavaScript object.
 * Supports MIDI format 0 and 1.
 */
export class MidiParser {
  /**
   * @private
   * @type {DataView}
   */
  private _dataView: DataView;

  /**
   * @private
   * @type {number}
   */
  private _offset: number = 0;

  /**
   * @private
   * @type {number | null}
   */
  private _lastStatusByte: number | null = null; // For running status

  /**
   * Creates an instance of MidiParser.
   * @param {ArrayBuffer} arrayBuffer The ArrayBuffer containing the MIDI file data.
   */
  constructor(arrayBuffer: ArrayBuffer) {
    if (!(arrayBuffer instanceof ArrayBuffer)) {
      throw new Error("Input must be an ArrayBuffer.");
    }
    this._dataView = new DataView(arrayBuffer);
  }

  /**
   * Reads a specified number of bytes from the DataView and advances the offset.
   * @private
   * @param {number} count The number of bytes to read.
   * @returns {Uint8Array} A Uint8Array containing the read bytes.
   */
  private _readBytes(count: number): Uint8Array {
    if (this._offset + count > this._dataView.byteLength) {
      throw new Error(
        `Unexpected end of file while trying to read ${count} bytes at offset ${this._offset}.`,
      );
    }
    const bytes = new Uint8Array(this._dataView.buffer, this._offset, count);
    this._offset += count;
    return bytes;
  }

  /**
   * Reads a 32-bit unsigned integer from the DataView (big-endian).
   * @private
   * @returns {number} The 32-bit unsigned integer.
   */
  private _readUint32(): number {
    const value = this._dataView.getUint32(this._offset, false); // false for big-endian
    this._offset += 4;
    return value;
  }

  /**
   * Reads a 16-bit unsigned integer from the DataView (big-endian).
   * @private
   * @returns {number} The 16-bit unsigned integer.
   */
  private _readUint16(): number {
    const value = this._dataView.getUint16(this._offset, false); // false for big-endian
    this._offset += 2;
    return value;
  }

  /**
   * Reads an 8-bit unsigned integer (byte) from the DataView.
   * @private
   * @returns {number} The 8-bit unsigned integer.
   */
  private _readUint8(): number {
    if (this._offset >= this._dataView.byteLength) {
      throw new Error(
        `Unexpected end of file while trying to read byte at offset ${this._offset}.`,
      );
    }
    const value = this._dataView.getUint8(this._offset);
    this._offset += 1;
    return value;
  }

  /**
   * Reads a variable-length quantity (VLQ).
   * Used for delta times and meta event lengths.
   * @private
   * @returns {number} The decoded VLQ value.
   */
  private _readVariableLengthQuantity(): number {
    let value = 0;
    let byte: number;
    do {
      byte = this._readUint8();
      value = (value << 7) | (byte & 0x7f);
    } while (byte & 0x80); // Continue if the most significant bit is set
    return value;
  }

  /**
   * Parses the MIDI Header Chunk (MThd).
   * @private
   * @returns {MidiHeader} An object containing header information.
   */
  private _parseHeaderChunk(): MidiHeader {
    const chunkType = new TextDecoder().decode(this._readBytes(4));
    if (chunkType !== "MThd") {
      throw new Error(
        `Expected 'MThd' chunk, but got '${chunkType}' at offset ${this._offset - 4}.`,
      );
    }

    const chunkSize = this._readUint32();
    if (chunkSize !== 6) {
      console.warn(
        `MThd chunk size is ${chunkSize}, expected 6. This might be an invalid MIDI file.`,
      );
    }

    const format = this._readUint16();
    const numTracks = this._readUint16();
    const timeDivisionRaw = this._readUint16();

    let ticksPerBeat: number | null = null;
    let framesPerSecond: number | null = null;
    let ticksPerFrame: number | null = null;

    // Check the 15th bit of timeDivision to determine if it's SMPTE or PPQ
    if (timeDivisionRaw & 0x8000) {
      // SMPTE time code
      framesPerSecond = -(timeDivisionRaw >> 8) & 0x7f; // Negative value indicates SMPTE format
      ticksPerFrame = timeDivisionRaw & 0xff;
    } else {
      // Metrical time (PPQ - Pulses Per Quarter note)
      ticksPerBeat = timeDivisionRaw;
    }

    return {
      chunkType,
      chunkSize,
      format,
      numTracks,
      timeDivision: {
        raw: timeDivisionRaw,
        ticksPerBeat,
        framesPerSecond,
        ticksPerFrame,
      },
    };
  }

  /**
   * Parses a MIDI Meta Event.
   * @private
   * @returns {Omit<MetaEvent, 'deltaTime'>} An object representing the meta event.
   */
  private _parseMetaEvent(): Omit<MetaEvent, "deltaTime"> {
    const metaType = this._readUint8();
    const length = this._readVariableLengthQuantity();
    const data = this._readBytes(length);
    const textDecoder = new TextDecoder();

    let value: string | number | object | Uint8Array;
    switch (metaType) {
      case 0x00:
        value = "Sequence Number";
        break;
      case 0x01:
        value = textDecoder.decode(data);
        break; // Text Event
      case 0x02:
        value = textDecoder.decode(data);
        break; // Copyright Notice
      case 0x03:
        value = textDecoder.decode(data);
        break; // Sequence/Track Name
      case 0x04:
        value = textDecoder.decode(data);
        break; // Instrument Name
      case 0x05:
        value = textDecoder.decode(data);
        break; // Lyric
      case 0x06:
        value = textDecoder.decode(data);
        break; // Marker
      case 0x07:
        value = textDecoder.decode(data);
        break; // Cue Point
      case 0x20:
        value = data[0];
        break; // MIDI Channel Prefix
      case 0x2f:
        value = "End of Track";
        break;
      case 0x51: // Set Tempo
        value = (data[0] << 16) | (data[1] << 8) | data[2]; // tempo in microseconds per quarter note
        break;
      case 0x54: // SMPTE Offset
        value = {
          hour: data[0],
          minute: data[1],
          second: data[2],
          frame: data[3],
          subFrame: data[4],
        };
        break;
      case 0x58: // Time Signature
        value = {
          numerator: data[0],
          denominator: Math.pow(2, data[1]), // 2^denominator
          midiClocksPerClick: data[2],
          num32ndNotesPerQuarter: data[3],
        };
        break;
      case 0x59: // Key Signature
        value = {
          sharpsFlats: data[0], // -7 for 7 flats, 0 for C, 7 for 7 sharps
          majorMinor: data[1], // 0 for major, 1 for minor
        };
        break;
      case 0x7f:
        value = "Sequencer Specific Meta-event";
        break;
      default:
        value = data; // Raw data for unknown meta types
    }

    return {
      type: "meta",
      metaType,
      metaTypeName: `0x${metaType.toString(16).toUpperCase()}`, // Hex representation
      length,
      data,
      value, // Decoded value if known, otherwise raw data
    };
  }

  /**
   * Parses a MIDI System Exclusive (Sysex) Event.
   * @private
   * @returns {Omit<SysexEvent, 'deltaTime'>} An object representing the sysex event.
   */
  private _parseSysexEvent(): Omit<SysexEvent, "deltaTime"> {
    const sysexData: number[] = [];
    let byte: number;
    // Read bytes until 0xF7 (End of Sysex) is encountered
    while (this._offset < this._dataView.byteLength) {
      byte = this._readUint8();
      if (byte === 0xf7) {
        break; // End of Sysex
      }
      sysexData.push(byte);
    }
    return {
      type: "sysex",
      data: new Uint8Array(sysexData),
    };
  }

  /**
   * Parses a single MIDI event within a track.
   * Handles running status.
   * @private
   * @param {number} initialStatusByte The first byte after delta time, or null if running status is active.
   * @returns {Omit<AnyMidiEvent, 'deltaTime'>} An object representing the MIDI event without deltaTime.
   */
  private _parseMidiEvent(
    initialStatusByte: number,
  ): Omit<AnyMidiEvent, "deltaTime"> {
    let statusByte: number;
    let data1: number;
    let data2: number;

    if (initialStatusByte >= 0x80) {
      // New status byte
      statusByte = initialStatusByte;
      this._lastStatusByte = statusByte;
    } else {
      // Running status: use the last status byte
      statusByte = this._lastStatusByte as number; // Assert as number, as it should be set
      // If no last status byte (e.g., first event in track is running status),
      // or if the initial byte was not a status byte but running status isn't set,
      // this is an error or unexpected format.
      if (statusByte === null) {
        throw new Error(
          `Running status expected but no previous status byte found at offset ${this._offset - 1}.`,
        );
      }
      // The initial byte was actually the first data byte for running status
      this._offset--; // Rewind to re-read initialStatusByte as data1
    }

    const channel = statusByte & 0x0f; // Channel is the lower 4 bits

    const eventType = statusByte & 0xf0; // Event type is the upper 4 bits

    switch (eventType) {
      case 0x80: // Note Off
        data1 = this._readUint8(); // Note number
        data2 = this._readUint8(); // Velocity
        return {
          type: "noteOff",
          channel,
          noteNumber: data1,
          velocity: data2,
        } as NoteEvent;
      case 0x90: // Note On
        data1 = this._readUint8(); // Note number
        data2 = this._readUint8(); // Velocity
        // A Note On with velocity 0 is often interpreted as a Note Off
        if (data2 === 0) {
          return {
            type: "noteOff",
            channel,
            noteNumber: data1,
            velocity: data2,
          } as NoteEvent;
        }
        return {
          type: "noteOn",
          channel,
          noteNumber: data1,
          velocity: data2,
        } as NoteEvent;
      case 0xa0: // Polyphonic Aftertouch (Key Pressure)
        data1 = this._readUint8(); // Note number
        data2 = this._readUint8(); // Pressure value
        return {
          type: "polyphonicAftertouch",
          channel,
          noteNumber: data1,
          pressure: data2,
        } as PolyphonicAftertouchEvent;
      case 0xb0: // Control Change
        data1 = this._readUint8(); // Controller number
        data2 = this._readUint8(); // Value
        return {
          type: "controlChange",
          channel,
          controllerNumber: data1,
          value: data2,
        } as ControlChangeEvent;
      case 0xc0: // Program Change
        data1 = this._readUint8(); // Program number
        return {
          type: "programChange",
          channel,
          programNumber: data1,
        } as ProgramChangeEvent;
      case 0xd0: // Channel Aftertouch (Channel Pressure)
        data1 = this._readUint8(); // Pressure value
        return {
          type: "channelAftertouch",
          channel,
          pressure: data1,
        } as ChannelAftertouchEvent;
      case 0xe0: {
        // Pitch Bend Change
        data1 = this._readUint8(); // LSB of pitch bend value
        data2 = this._readUint8(); // MSB of pitch bend value
        // Pitch bend value is 14-bit, 0-16383, with 8192 being center
        const pitchBendValue = (data2 << 7) | data1;
        return {
          type: "pitchBend",
          channel,
          value: pitchBendValue,
        } as PitchBendEvent;
      }

      case 0xf0: // System Common and System Real-Time Messages
        // 0xF0 (Sysex Start), 0xF1 (MIDI Time Code Quarter Frame), 0xF2 (Song Position Pointer),
        // 0xF3 (Song Select), 0xF6 (Tune Request), 0xF8 (Timing Clock), 0xFA (Start),
        // 0xFB (Continue), 0xFC (Stop), 0xFE (Active Sensing), 0xFF (System Reset)
        if (statusByte === 0xf0) {
          return this._parseSysexEvent();
        } else if (statusByte === 0xf7) {
          // 0xF7 can be an end of sysex or continuation of sysex
          // For now, treat it as end of sysex, data will be handled by _parseSysexEvent
          // If 0xF7 appears as a standalone status byte, it's typically a Sysex continuation.
          // However, in MIDI files, 0xF0...0xF7 is a single event.
          // If we encounter 0xF7 here, it means it's not part of an F0 block.
          // This is less common in standard MIDI files as a standalone event.
          // For simplicity, we'll assume it's part of a _parseSysexEvent call.
          // If it's encountered directly, it implies an error or non-standard MIDI.
          console.warn(
            `Unexpected 0xF7 status byte at offset ${this._offset - 1}.`,
          );
          return {
            type: "unknown",
            status: statusByte,
            data: new Uint8Array([]),
          } as UnknownEvent;
        } else if (statusByte === 0xff) {
          return this._parseMetaEvent();
        } else {
          // Handle other system common messages (e.g., 0xF1, 0xF2, 0xF3, 0xF6)
          // These typically have fixed lengths
          const eventData: number[] = [];
          switch (statusByte) {
            case 0xf1: // MIDI Time Code Quarter Frame
            case 0xf3: // Song Select
              eventData.push(this._readUint8());
              break;
            case 0xf2: // Song Position Pointer
              eventData.push(this._readUint8());
              eventData.push(this._readUint8());
              break;
            case 0xf4: // Undefined
            case 0xf5: // Undefined
            case 0xf6: // Tune Request
            case 0xf8: // Timing Clock
            case 0xf9: // Undefined
            case 0xfa: // Start
            case 0xfb: // Continue
            case 0xfc: // Stop
            case 0xfd: // Undefined
            case 0xfe: // Active Sensing
              // No data bytes for these
              break;
            default:
              console.warn(
                `Unknown System Common message: 0x${statusByte.toString(16).toUpperCase()} at offset ${this._offset - 1}.`,
              );
              break;
          }
          return {
            type: "systemCommon",
            status: statusByte,
            data: new Uint8Array(eventData),
          } as SystemCommonEvent;
        }
      default:
        console.warn(
          `Unknown MIDI event type: 0x${eventType.toString(16).toUpperCase()} (Status: 0x${statusByte.toString(16).toUpperCase()}) at offset ${this._offset - 1}.`,
        );
        return {
          type: "unknown",
          status: statusByte,
          data: new Uint8Array([]),
        } as UnknownEvent;
    }
  }

  /**
   * Parses a MIDI Track Chunk (MTrk).
   * @private
   * @returns {MidiTrack} An object containing track events.
   */
  private _parseTrackChunk(): MidiTrack {
    const chunkType = new TextDecoder().decode(this._readBytes(4));
    if (chunkType !== "MTrk") {
      throw new Error(
        `Expected 'MTrk' chunk, but got '${chunkType}' at offset ${this._offset - 4}.`,
      );
    }

    const chunkSize = this._readUint32();
    const trackEndOffset = this._offset + chunkSize;
    const events: AnyMidiEvent[] = [];

    this._lastStatusByte = null; // Reset running status for each new track

    while (this._offset < trackEndOffset) {
      const deltaTime = this._readVariableLengthQuantity();
      const initialByte = this._readUint8(); // Peek at the next byte to determine if it's a status byte or data byte

      let event: Omit<AnyMidiEvent, "deltaTime">;
      try {
        event = this._parseMidiEvent(initialByte);
      } catch (e: unknown) {
        console.error(
          `Error parsing MIDI event at offset ${this._offset - 1}: ${e instanceof Error ? e.message : String(e)}`,
        );
        // Attempt to skip to the end of the track to continue parsing other tracks
        this._offset = trackEndOffset;
        break;
      }

      events.push({
        ...event,
        deltaTime,
      } as AnyMidiEvent);

      // If it's an End of Track meta event, we can stop parsing this track early
      if (
        event &&
        event.type === "meta" &&
        (event as MetaEvent).metaType === 0x2f
      ) {
        break;
      }
    }

    // Ensure we consume all bytes for this track, even if we stopped early due to End of Track
    this._offset = trackEndOffset;

    return {
      chunkType,
      chunkSize,
      events,
    };
  }

  /**
   * Parses the entire MIDI file.
   * @public
   * @returns {ParsedMidiData} A structured object representing the parsed MIDI data.
   */
  public parse(): ParsedMidiData {
    const midiData: ParsedMidiData = {
      header: {} as MidiHeader, // Initialize with a placeholder
      tracks: [],
    };

    // Parse Header Chunk
    midiData.header = this._parseHeaderChunk();

    // Parse Track Chunks
    for (let i = 0; i < midiData.header.numTracks; i++) {
      try {
        midiData.tracks.push(this._parseTrackChunk());
      } catch (e: unknown) {
        console.error(
          `Error parsing track ${i}: ${e instanceof Error ? e.message : String(e)}`,
        );
        // If a track fails to parse, try to continue with the next one
        // (assuming the error didn't corrupt the overall offset too badly)
        break; // Or continue to next track if robust error recovery is needed
      }
    }

    return midiData;
  }
}
