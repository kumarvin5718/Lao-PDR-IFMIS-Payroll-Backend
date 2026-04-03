import { Drawer } from "antd";

/** TODO: collapsible audit history panel. */
export function AuditTrailSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Drawer title="Audit trail" placement="right" open={open} onClose={onClose}>
      <div>AuditTrailSidebar</div>
    </Drawer>
  );
}
