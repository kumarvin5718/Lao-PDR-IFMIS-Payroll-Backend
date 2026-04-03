import { Layout } from "antd";
import { Outlet } from "react-router-dom";

import { HeaderBar } from "./Header";
import { Sidebar } from "./Sidebar";

const { Sider, Content } = Layout;

export function AppLayout() {
  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider width={240}>
        <Sidebar />
      </Sider>
      <Layout>
        <HeaderBar />
        <Content style={{ padding: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
