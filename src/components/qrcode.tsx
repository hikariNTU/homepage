import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";

export function QRCodePage() {
  const [text, setText] = useState("https://google.com");
  return (
    <div className="flex h-screen flex-col items-center justify-center">
      <div className="flex flex-col items-start gap-2">
        <label className="flex w-full flex-col items-start gap-2 text-sm">
          QR Code Text
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full rounded border border-gray-300 p-2"
          />
        </label>
        <QRCodeSVG value={text} size={256} />
      </div>
    </div>
  );
}
