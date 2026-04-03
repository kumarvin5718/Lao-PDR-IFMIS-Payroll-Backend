import { embedDashboard } from "@superset-ui/embedded-sdk";
import { Alert, Spin, Typography } from "antd";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { getGuestToken } from "@/api/superset";

function supersetPublicOrigin(): string {
  const fromEnv = import.meta.env.VITE_SUPERSET_ORIGIN?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    return `${window.location.origin}/superset`.replace(/\/$/, "");
  }
  return "";
}

export function SupersetDashboardPage() {
  const { t } = useTranslation();
  const mountRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dashboardId = import.meta.env.VITE_SUPERSET_DASHBOARD_ID?.trim() ?? "";

  useEffect(() => {
    if (!dashboardId) {
      setLoading(false);
      return;
    }

    const el = mountRef.current;
    if (!el) return;

    let unmountEmbedded: (() => void) | undefined;

    (async () => {
      setError(null);
      setLoading(true);
      const supersetDomain = supersetPublicOrigin();
      if (!supersetDomain) {
        setError(t("page.dashboards.superset.err_no_origin"));
        setLoading(false);
        return;
      }

      try {
        const result = await embedDashboard({
          id: dashboardId,
          supersetDomain,
          mountPoint: el,
          fetchGuestToken: () => getGuestToken(dashboardId),
          dashboardUiConfig: {
            hideTitle: false,
            hideTab: false,
          },
          iframeTitle: "Superset",
        });
        unmountEmbedded = result.unmount;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      unmountEmbedded?.();
    };
  }, [dashboardId]);

  if (!dashboardId) {
    return (
      <div>
        <Typography.Title level={4}>{t("page.dashboards.superset.title")}</Typography.Title>
        <Alert
          type="warning"
          showIcon
          message={t("page.dashboards.superset.missing_id_title")}
          description={t("page.dashboards.superset.missing_id_desc")}
        />
      </div>
    );
  }

  return (
    <div>
      <Typography.Title level={4}>{t("page.dashboards.superset.title")}</Typography.Title>
      {error && (
        <Alert
          type="error"
          showIcon
          closable
          message={t("page.dashboards.superset.embed_error")}
          description={error}
          style={{ marginBottom: 16 }}
        />
      )}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "calc(100vh - 120px)",
        }}
      >
        {loading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1,
            }}
          >
            <Spin size="large" />
          </div>
        )}
        <div ref={mountRef} style={{ width: "100%", height: "100%" }} />
      </div>
    </div>
  );
}
