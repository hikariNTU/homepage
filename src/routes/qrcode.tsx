import { QRCodePage } from "@/components/qrcode";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/qrcode")({
  component: () => <QRCodePage />,
  head() {
    return {
      meta: [
        {
          title: "QR Code | Dennis Chung personal website",
        },
      ],
    };
  },
});
