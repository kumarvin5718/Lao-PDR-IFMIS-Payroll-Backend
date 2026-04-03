import { Modal } from "antd";

/** TODO: bulk upload modal (Section 6). */
export function BulkUploadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onCancel={onClose} title="Bulk upload" footer={null}>
      <div>BulkUploadModal</div>
    </Modal>
  );
}
