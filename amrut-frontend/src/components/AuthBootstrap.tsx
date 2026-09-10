import { useEffect, useRef } from "react";
import { useAuthStore } from "@/store/auth.store";

export default function AuthBootstrap() {
  const initializeAuth = useAuthStore((state) => state.initializeAuth);
  const didRunRef = useRef(false);

  useEffect(() => {
    if (didRunRef.current) {
      return;
    }

    didRunRef.current = true;

    void initializeAuth();
  }, [initializeAuth]);

  return null;
}
