import { AppShell } from "@/components/shell/app-shell";
import { UploadWorkspace } from "@/components/upload/upload-workspace";

export default function NewJobPage() {
  return <AppShell active={1}><UploadWorkspace /></AppShell>;
}
