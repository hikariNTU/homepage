import { createLazyFileRoute } from "@tanstack/react-router";
import React, { useState, useCallback } from "react";
import {
  MidiParser,
  type ParsedMidiData,
  type AnyMidiEvent,
  type MetaEvent,
} from "../lib/midi-parser";
import { TooltipWrap } from "@/components/tooltip";
import { Music4Icon, UploadIcon } from "lucide-react";

export const Route = createLazyFileRoute("/midi-parser")({
  component: MidiPage,
});

function MidiPage() {
  const [parsedData, setParsedData] = useState<ParsedMidiData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileUpload = useCallback(async (file: File) => {
    if (
      !file.name.toLowerCase().endsWith(".mid") &&
      !file.name.toLowerCase().endsWith(".midi")
    ) {
      setError("Please upload a valid MIDI file (.mid or .midi)");
      return;
    }

    setIsLoading(true);
    setError(null);
    setFileName(file.name);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const parser = new MidiParser(arrayBuffer);
      const parsed = parser.parse();
      setParsedData(parsed);
    } catch (err) {
      setError(
        `Error parsing MIDI file: ${
          err instanceof Error ? err.message : "Unknown error"
        }`,
      );
      setParsedData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        handleFileUpload(files[0]);
      }
    },
    [handleFileUpload],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFileUpload(files[0]);
      }
    },
    [handleFileUpload],
  );

  const formatMetaEventValue = (event: MetaEvent) => {
    if (typeof event.value === "string") {
      return `"${event.value}"`;
    } else if (typeof event.value === "object" && event.value !== null) {
      return JSON.stringify(event.value, null, 2);
    }
    return String(event.value);
  };

  const getEventDisplayInfo = (event: AnyMidiEvent) => {
    switch (event.type) {
      case "noteOn":
      case "noteOff":
        return `Note: ${event.noteNumber} (${getNoteNameFromNumber(event.noteNumber)}), Velocity: ${event.velocity}`;
      case "controlChange":
        return `Controller: ${event.controllerNumber}, Value: ${event.value}`;
      case "programChange":
        return `Program: ${event.programNumber}`;
      case "pitchBend":
        return `Value: ${event.value}`;
      case "meta":
        return `Type: ${event.metaTypeName}, ${formatMetaEventValue(event)}`;
      case "polyphonicAftertouch":
        return `Note: ${event.noteNumber}, Pressure: ${event.pressure}`;
      case "channelAftertouch":
        return `Pressure: ${event.pressure}`;
      case "sysex":
        return `Data length: ${event.data?.length || 0} bytes`;
      default:
        return JSON.stringify(event, null, 2);
    }
  };

  const getNoteNameFromNumber = (noteNumber: number) => {
    const noteNames = [
      "C",
      "C#",
      "D",
      "D#",
      "E",
      "F",
      "F#",
      "G",
      "G#",
      "A",
      "A#",
      "B",
    ];
    const octave = Math.floor(noteNumber / 12) - 1;
    const note = noteNames[noteNumber % 12];
    return `${note}${octave}`;
  };

  const getEventTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      noteOn: "bg-green-100 text-green-800",
      noteOff: "bg-red-100 text-red-800",
      controlChange: "bg-blue-100 text-blue-800",
      programChange: "bg-purple-100 text-purple-800",
      pitchBend: "bg-yellow-100 text-yellow-800",
      meta: "bg-gray-100 text-gray-800",
      polyphonicAftertouch: "bg-indigo-100 text-indigo-800",
      channelAftertouch: "bg-pink-100 text-pink-800",
      sysex: "bg-orange-100 text-orange-800",
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="flex min-h-screen flex-col justify-stretch gap-12 bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-8 text-3xl font-bold text-gray-900">
          Online MIDI Parser & Inspector
        </h1>

        {/* Upload Area */}
        <div
          className={`mb-8 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            isDragOver
              ? "border-blue-400 bg-blue-50"
              : "border-gray-300 bg-white"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="space-y-4">
            <div className="flex justify-center text-gray-300">
              {isDragOver ? <UploadIcon size={48} /> : <Music4Icon size={48} />}
            </div>
            <div>
              <p className="text-lg font-medium text-gray-900">
                {isDragOver ? "Drop your MIDI file here" : "Upload a MIDI file"}
              </p>
              <p className="text-sm text-gray-500">
                Drag and drop a .mid or .midi file, or click to browse
              </p>
            </div>
            <input
              type="file"
              accept=".mid,.midi"
              onChange={handleFileSelect}
              className="hidden"
              id="midi-upload"
            />
            <label
              htmlFor="midi-upload"
              className="inline-flex cursor-pointer items-center rounded-full bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Choose File
            </label>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="mb-8 rounded-lg bg-blue-50 p-4">
            <div className="flex items-center space-x-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
              <span className="text-blue-800">Parsing MIDI file...</span>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-8 rounded-lg bg-red-50 p-4">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">❌</span>
              <span className="text-red-800">{error}</span>
            </div>
          </div>
        )}

        {/* Parsed Data Display */}
        {parsedData && (
          <div className="space-y-6">
            {/* File Info */}
            {fileName && (
              <div className="rounded-lg bg-white p-4 shadow">
                <h2 className="mb-2 text-lg font-semibold text-gray-900">
                  File Information
                </h2>
                <p className="text-gray-600">Filename: {fileName}</p>
              </div>
            )}

            {/* Header Info */}
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-xl font-semibold text-gray-900">
                MIDI Header
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg bg-gray-50 p-3">
                  <div className="text-sm font-medium text-gray-500">
                    Format
                  </div>
                  <div className="text-lg font-semibold">
                    {parsedData.header.format}
                  </div>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <div className="text-sm font-medium text-gray-500">
                    Tracks
                  </div>
                  <div className="text-lg font-semibold">
                    {parsedData.header.numTracks}
                  </div>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <div className="text-sm font-medium text-gray-500">
                    Ticks per Beat
                  </div>
                  <div className="text-lg font-semibold">
                    {parsedData.header.timeDivision.ticksPerBeat || "N/A"}
                  </div>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <div className="text-sm font-medium text-gray-500">
                    Time Division (Raw)
                  </div>
                  <div className="text-lg font-semibold">
                    {parsedData.header.timeDivision.raw}
                  </div>
                </div>
              </div>
            </div>

            {/* Tracks */}
            {parsedData.tracks.map((track, trackIndex) => {
              let accumulatedTime = 0;

              return (
                <div
                  key={trackIndex}
                  className="rounded-lg bg-white p-6 shadow"
                >
                  <h3 className="mb-4 text-lg font-semibold text-gray-900">
                    Track {trackIndex + 1} ({track.events.length} events)
                  </h3>

                  <div className="">
                    <div className="space-y-2">
                      {track.events.map(
                        (event: AnyMidiEvent, eventIndex: number) => {
                          accumulatedTime += event.deltaTime;
                          const isSimultaneous =
                            event.deltaTime === 0 && eventIndex > 0;

                          return (
                            <div
                              key={eventIndex}
                              className="flex items-start space-x-3 rounded-lg border p-3 text-sm"
                            >
                              <div className="flex-shrink-0">
                                <span className="font-mono text-xs text-gray-500">
                                  {eventIndex.toString().padStart(4, "0")}
                                </span>
                              </div>
                              <div className="min-w-10 flex-shrink-0">
                                {isSimultaneous ? (
                                  <div className="group relative">
                                    <TooltipWrap
                                      content={`Same time as previous event (T=${accumulatedTime})`}
                                      side="right"
                                    >
                                      <span className="rounded border border-orange-200 bg-orange-50 px-1 font-mono text-xs text-orange-600">
                                        Δ0*
                                      </span>
                                    </TooltipWrap>
                                  </div>
                                ) : (
                                  <span className="font-mono text-xs text-gray-600">
                                    Δ{event.deltaTime}
                                  </span>
                                )}
                              </div>
                              <div className="min-w-12 flex-shrink-0">
                                <span className="font-mono text-xs text-gray-400">
                                  T={accumulatedTime}
                                </span>
                              </div>
                              <div className="flex-shrink-0">
                                <span
                                  className={`rounded-full px-2 py-1 text-xs font-medium ${getEventTypeColor(
                                    event.type,
                                  )}`}
                                >
                                  {event.type}
                                </span>
                              </div>
                              {event.channel !== undefined && (
                                <div className="flex-shrink-0">
                                  <span className="text-xs text-gray-500">
                                    Ch{event.channel}
                                  </span>
                                </div>
                              )}
                              <div className="flex-1 truncate">
                                <span className="text-gray-700">
                                  {getEventDisplayInfo(event)}
                                </span>
                              </div>
                            </div>
                          );
                        },
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <footer className="my-12 mt-auto text-center text-sm text-gray-500">
        <p>
          Made with 🤖 by{" "}
          <a
            href="https://github.com/hikariNTU"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-gray-900 hover:underline"
          >
            Dennis Chung
          </a>
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Code generated by Claude Sonnet 4 at{" "}
          <time>
            {new Date("2025-07-10T04:32:58.879Z").toLocaleDateString()}
          </time>
        </p>
      </footer>
    </div>
  );
}
