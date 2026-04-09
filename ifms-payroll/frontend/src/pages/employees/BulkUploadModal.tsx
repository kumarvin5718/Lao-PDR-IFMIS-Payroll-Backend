/** Screen: `BulkUploadModal` — page-level UI and mutations. */
import { Modal } from "antd";
import { useTranslation } from "react-i18next";

/** TODO: bulk upload modal (Section 6). */
export function BulkUploadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Modal open={open} onCancel={onClose} title={t("upload.modal_title")} footer={null}>
      <div>{t("upload.modal_stub")}</div>
    </Modal>
  );
}
