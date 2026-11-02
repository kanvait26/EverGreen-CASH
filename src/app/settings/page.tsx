"use client";

import { Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/toast";
import { hashPin } from "@/lib/crypto";
import { APP_VERSION } from "@/lib/types";
import { getSettings, updateSettings } from "@/lib/settings";
import { takeSnapshot } from "@/lib/backup";
import { downloadBytes } from "@/lib/backup";
import { useEffect, useState } from "react";

export default function SettingsPage() {
  const { push } = useToast();
  const [companyName, setCompanyName] = useState("");
  const [companyNameAr, setCompanyNameAr] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [currency, setCurrency] = useState("ILS");
  const [prefix, setPrefix] = useState("EG-");
  const [footer, setFooter] = useState("");
  const [autoBackup, setAutoBackup] = useState(true);
  const [interval, setInterval] = useState(30);
  const [pin, setPin] = useState("");
  const [pinEnabled, setPinEnabled] = useState(false);
  const [lockMin, setLockMin] = useState(5);
  const [storage, setStorage] = useState("");
  const [logo, setLogo] = useState("/logo.jpg");

  useEffect(() => {
    getSettings().then((s) => {
      setCompanyName(s.companyName);
      setCompanyNameAr(s.companyNameAr);
      setAddress(s.address);
      setPhone(s.phone);
      setCurrency(s.defaultCurrency);
      setPrefix(s.invoicePrefix);
      setFooter(s.invoiceFooter);
      setAutoBackup(s.autoBackupEnabled);
      setInterval(s.backupIntervalMinutes);
      setPinEnabled(s.pinEnabled);
      setLockMin(s.autoLockMinutes);
      setLogo(s.logoDataUrl);
    });
    if (navigator.storage?.estimate) {
      navigator.storage.estimate().then((e) => {
        const used = Math.round((e.usage ?? 0) / 1024);
        const quota = Math.round((e.quota ?? 0) / 1024);
        setStorage(`${used} ك.ب من ${quota} ك.ب`);
      });
    }
  }, []);

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold text-forest-800">الإعدادات</h1>
      <Card className="grid gap-4 md:grid-cols-2">
        <Field label="اسم الشركة">
          <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
        </Field>
        <Field label="الاسم بالعربية">
          <Input value={companyNameAr} onChange={(e) => setCompanyNameAr(e.target.value)} />
        </Field>
        <Field label="العنوان">
          <Input value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <Field label="الهاتف">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="العملة الافتراضية">
          <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="ILS">ILS ₪</option>
            <option value="USD">USD $</option>
            <option value="JOD">JOD</option>
            <option value="EUR">EUR</option>
          </Select>
        </Field>
        <Field label="بادئة الفاتورة">
          <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} />
        </Field>
        <div className="md:col-span-2">
          <Field label="تذييل الفاتورة">
            <Textarea value={footer} onChange={(e) => setFooter(e.target.value)} />
          </Field>
        </div>
        <div className="md:col-span-2">
          <p className="mb-2 text-sm font-semibold">الشعار (يُستخدم كما هو)</p>
          <img src={logo} alt="logo" className="h-24 rounded-2xl object-contain" />
          <input
            type="file"
            accept="image/*"
            className="mt-2"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const reader = new FileReader();
              reader.onload = () => setLogo(String(reader.result));
              reader.readAsDataURL(f);
            }}
          />
        </div>
      </Card>
      <Card className="space-y-3">
        <h2 className="font-bold">النسخ الاحتياطي</h2>
        <label className="flex items-center gap-3">
          <input type="checkbox" className="h-6 w-6" checked={autoBackup} onChange={(e) => setAutoBackup(e.target.checked)} />
          محاولة نسخ تلقائي أفضل-جهد عند الاتصال (قد يعلّقه iPadOS)
        </label>
        <Field label="الفاصل بالدقائق">
          <Input type="number" value={interval} onChange={(e) => setInterval(Number(e.target.value))} />
        </Field>
      </Card>
      <Card className="space-y-3">
        <h2 className="font-bold">قفل PIN</h2>
        <p className="text-sm text-forest-600">قفل داخل التطبيق فقط، وليس تشفير الجهاز أو IndexedDB.</p>
        <label className="flex items-center gap-3">
          <input type="checkbox" className="h-6 w-6" checked={pinEnabled} onChange={(e) => setPinEnabled(e.target.checked)} />
          تفعيل PIN
        </label>
        <Field label="PIN جديد (٤–٨ أرقام)">
          <Input inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} />
        </Field>
        <Field label="قفل تلقائي (دقائق)">
          <Input type="number" value={lockMin} onChange={(e) => setLockMin(Number(e.target.value))} />
        </Field>
      </Card>
      <Button
        onClick={async () => {
          try {
            const patch: Record<string, unknown> = {
              companyName,
              companyNameAr,
              address,
              phone,
              defaultCurrency: currency,
              invoicePrefix: prefix,
              invoiceFooter: footer,
              autoBackupEnabled: autoBackup,
              backupIntervalMinutes: interval,
              pinEnabled,
              autoLockMinutes: lockMin,
              logoDataUrl: logo,
            };
            if (pinEnabled && pin) {
              const hashed = await hashPin(pin);
              patch.pinHash = hashed.hash;
              patch.pinSalt = hashed.salt;
            }
            if (!pinEnabled) {
              patch.pinHash = "";
              patch.pinSalt = "";
            }
            await updateSettings(patch);
            push("حُفظت الإعدادات");
          } catch (err) {
            push(err instanceof Error ? err.message : "فشل", "err");
          }
        }}
      >
        حفظ الإعدادات
      </Button>
      <Card className="space-y-2 text-sm">
        <p>إصدار التطبيق: {APP_VERSION}</p>
        <p>التخزين: {storage || "غير متاح"}</p>
        <Button
          variant="secondary"
          onClick={async () => {
            const snap = await takeSnapshot();
            const bytes = new TextEncoder().encode(JSON.stringify(snap, null, 2));
            downloadBytes(`evergreen-plain-${Date.now()}.json`, bytes, "application/json");
            push("صدّر البيانات الخام محلياً — احفظها في مكان آمن");
          }}
        >
          تصدير JSON غير مشفّر (محلي فقط)
        </Button>
      </Card>
    </div>
  );
}
