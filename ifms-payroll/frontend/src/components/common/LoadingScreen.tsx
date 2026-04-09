/** Shared UI: `LoadingScreen`. */
import { Spin } from "antd";

export function LoadingScreen() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <Spin size="large" />
    </div>
  );
}
