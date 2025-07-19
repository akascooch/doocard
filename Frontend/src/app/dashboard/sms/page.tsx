"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { useToast } from "@/components/ui/use-toast"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import axios from "axios"

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border p-6 rounded-xl">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      {children}
    </div>
  )
}

export default function SmsPage() {
  const { toast } = useToast()
  const [settings, setSettings] = useState<any>(null)
  const [templates, setTemplates] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    content: "",
    variables: [] as string[],
  })
  const [newMessage, setNewMessage] = useState({
    phoneNumber: "",
    message: "",
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [settingsRes, templatesRes, logsRes] = await Promise.all([
        axios.get("/sms/settings"),
        axios.get("/sms/templates"),
        axios.get("/sms/logs"),
      ])
      setSettings(settingsRes.data)
      setTemplates(templatesRes.data)
      setLogs(logsRes.data)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "خطا در بارگذاری اطلاعات",
        description: "لطفا صفحه را رفرش کنید",
      })
    }
  }

  const handleUpdateSettings = async (data: any) => {
    try {
      setLoading(true)
      await axios.post("/sms/settings", data)
      await loadData()
      toast({
        title: "تنظیمات ذخیره شد",
        description: "تغییرات با موفقیت اعمال شد",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "خطا در ذخیره تنظیمات",
        description: "لطفا دوباره تلاش کنید",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTemplate = async () => {
    try {
      setLoading(true)
      await axios.post("/sms/templates", newTemplate)
      await loadData()
      setNewTemplate({ name: "", content: "", variables: [] })
      toast({
        title: "قالب جدید ایجاد شد",
        description: "قالب پیامک با موفقیت ذخیره شد",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "خطا در ایجاد قالب",
        description: "لطفا دوباره تلاش کنید",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTemplate = async (id: number) => {
    try {
      await axios.delete(`/sms/templates/${id}`)
      await loadData()
      toast({
        title: "قالب حذف شد",
        description: "قالب پیامک با موفقیت حذف شد",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "خطا در حذف قالب",
        description: "لطفا دوباره تلاش کنید",
      })
    }
  }

  const handleSendMessage = async () => {
    try {
      setLoading(true)
      await axios.post("/sms/send", newMessage)
      setNewMessage({ phoneNumber: "", message: "" })
      await loadData()
      toast({
        title: "پیامک ارسال شد",
        description: "پیامک با موفقیت ارسال شد",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "خطا در ارسال پیامک",
        description: "لطفا دوباره تلاش کنید",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">مدیریت پیامک‌ها</h1>
      </div>

      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings">تنظیمات</TabsTrigger>
          <TabsTrigger value="templates">قالب‌های پیامک</TabsTrigger>
          <TabsTrigger value="send">ارسال پیامک</TabsTrigger>
          <TabsTrigger value="logs">گزارش‌ها</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-4">
          <Section title="تنظیمات پنل پیامک">
            <div className="grid gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">API Key</label>
                <input
                  type="text"
                  value={settings?.apiKey || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, apiKey: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg"
                  placeholder="کلید API پنل پیامک"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">شماره خط</label>
                <input
                  type="text"
                  value={settings?.lineNumber || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, lineNumber: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg"
                  placeholder="شماره خط ارسال پیامک"
                />
              </div>
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={settings?.isEnabled}
                    onChange={(e) =>
                      setSettings({ ...settings, isEnabled: e.target.checked })
                    }
                    className="form-checkbox"
                  />
                  <span>فعال‌سازی سیستم پیامک</span>
                </label>
              </div>
            </div>
          </Section>

          <Section title="تنظیمات ارسال خودکار">
            <div className="grid gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  ارسال پیامک قبل از نوبت (دقیقه)
                </label>
                <input
                  type="number"
                  value={settings?.sendBeforeAppointment || 60}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      sendBeforeAppointment: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  ارسال پیامک بعد از نوبت (دقیقه)
                </label>
                <input
                  type="number"
                  value={settings?.sendAfterAppointment || 0}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      sendAfterAppointment: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg"
                />
              </div>
            </div>
          </Section>

          <Button
            onClick={() => handleUpdateSettings(settings)}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Icon name="Loader" className="ml-2 animate-spin" />
                در حال ذخیره...
              </>
            ) : (
              <>
                <Icon name="Save" className="ml-2" />
                ذخیره تنظیمات
              </>
            )}
          </Button>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <Section title="قالب‌های موجود">
            <div className="grid gap-4">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between p-4 bg-background rounded-lg"
                >
                  <div>
                    <h4 className="font-medium">{template.name}</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {template.content}
                    </p>
                    <div className="flex gap-2 mt-2">
                      {template.variables.map((variable: string) => (
                        <span
                          key={variable}
                          className="px-2 py-1 text-xs bg-primary/10 text-primary rounded"
                        >
                          {variable}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteTemplate(template.id)}
                  >
                    <Icon name="Trash" size={16} />
                  </Button>
                </div>
              ))}
            </div>
          </Section>

          <Section title="ایجاد قالب جدید">
            <div className="grid gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">نام قالب</label>
                <input
                  type="text"
                  value={newTemplate.name}
                  onChange={(e) =>
                    setNewTemplate({ ...newTemplate, name: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg"
                  placeholder="مثال: یادآوری نوبت"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">متن پیام</label>
                <textarea
                  value={newTemplate.content}
                  onChange={(e) =>
                    setNewTemplate({ ...newTemplate, content: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg h-32"
                  placeholder="متن پیام با متغیرها. مثال: {نام} عزیز، نوبت شما برای ساعت {ساعت} روز {تاریخ} ثبت شد."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">متغیرها</label>
                <input
                  type="text"
                  value={newTemplate.variables.join(", ")}
                  onChange={(e) =>
                    setNewTemplate({
                      ...newTemplate,
                      variables: e.target.value.split(",").map((v) => v.trim()),
                    })
                  }
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg"
                  placeholder="نام, ساعت, تاریخ"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  متغیرها را با کاما از هم جدا کنید
                </p>
              </div>
            </div>
            <Button
              onClick={handleCreateTemplate}
              disabled={loading}
              className="w-full mt-4"
            >
              {loading ? (
                <>
                  <Icon name="Loader" className="ml-2 animate-spin" />
                  در حال ذخیره...
                </>
              ) : (
                <>
                  <Icon name="Plus" className="ml-2" />
                  ایجاد قالب
                </>
              )}
            </Button>
          </Section>
        </TabsContent>

        <TabsContent value="send" className="space-y-4">
          <Section title="ارسال پیامک">
            <div className="grid gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  شماره موبایل
                </label>
                <input
                  type="text"
                  value={newMessage.phoneNumber}
                  onChange={(e) =>
                    setNewMessage({ ...newMessage, phoneNumber: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg"
                  placeholder="09123456789"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">متن پیام</label>
                <textarea
                  value={newMessage.message}
                  onChange={(e) =>
                    setNewMessage({ ...newMessage, message: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg h-32"
                  placeholder="متن پیام را وارد کنید..."
                />
              </div>
            </div>
            <Button
              onClick={handleSendMessage}
              disabled={loading}
              className="w-full mt-4"
            >
              {loading ? (
                <>
                  <Icon name="Loader" className="ml-2 animate-spin" />
                  در حال ارسال...
                </>
              ) : (
                <>
                  <Icon name="Send" className="ml-2" />
                  ارسال پیامک
                </>
              )}
            </Button>
          </Section>

          <Section title="ارسال از قالب">
            <div className="grid gap-4">
              {templates.map((template) => (
                <Dialog key={template.id}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <Icon name="FileText" className="ml-2" />
                      {template.name}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>ارسال پیامک از قالب {template.name}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          شماره موبایل
                        </label>
                        <input
                          type="text"
                          className="w-full px-4 py-2 bg-background border border-border rounded-lg"
                          placeholder="09123456789"
                          dir="ltr"
                        />
                      </div>
                      {template.variables.map((variable: string) => (
                        <div key={variable}>
                          <label className="block text-sm font-medium mb-2">
                            {variable}
                          </label>
                          <input
                            type="text"
                            className="w-full px-4 py-2 bg-background border border-border rounded-lg"
                          />
                        </div>
                      ))}
                    </div>
                    <Button className="w-full">
                      <Icon name="Send" className="ml-2" />
                      ارسال پیامک
                    </Button>
                  </DialogContent>
                </Dialog>
              ))}
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Section title="گزارش ارسال پیامک‌ها">
            <div className="space-y-4">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="p-4 bg-background rounded-lg space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{log.phoneNumber}</span>
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        log.status === "SENT"
                          ? "bg-green-500/10 text-green-500"
                          : "bg-red-500/10 text-red-500"
                      }`}
                    >
                      {log.status === "SENT" ? "ارسال شده" : "خطا در ارسال"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{log.message}</p>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Icon name="Clock" size={12} className="ml-1" />
                    {new Date(log.createdAt).toLocaleDateString("fa-IR")}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  )
} 