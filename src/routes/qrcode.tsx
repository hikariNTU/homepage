import { QRCodePage } from "@/components/qrcode";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/qrcode")({
  component: () => <QRCodePage />,
});
