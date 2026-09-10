import { Toaster } from "sonner";

export function ToasterProvider() {
  return (
    <Toaster
      richColors
      position="top-right"
      closeButton
      duration={3000}
    />
  );
}