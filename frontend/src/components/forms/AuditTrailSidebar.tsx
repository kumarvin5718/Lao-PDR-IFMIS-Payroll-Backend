/** Form control: `AuditTrailSidebar` — lookups and cascades. */
import { Drawer } from "antd";
import { useTranslation } from "react-i18next";

/** TODO: collapsible audit history panel. */
export function AuditTrailSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Drawer title={t("audit.drawerTitle")} placement="right" open={open} onClose={onClose}>
      <div>{t("audit.drawerStub")}</div>
    </Drawer>
  );
}
