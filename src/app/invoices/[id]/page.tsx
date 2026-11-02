"use client";

import { InvoiceEditor } from "@/components/invoice-editor";
import { useParams } from "next/navigation";

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <InvoiceEditor invoiceId={id} />;
}
