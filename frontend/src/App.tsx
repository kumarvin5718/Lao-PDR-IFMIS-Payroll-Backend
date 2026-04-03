import { ConfigProvider } from "antd";
import { BrowserRouter } from "react-router-dom";

import { AppRouter } from "@/router";

export default function App() {
  return (
    <ConfigProvider>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </ConfigProvider>
  );
}
