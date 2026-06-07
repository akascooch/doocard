'use client';

import { useState } from 'react';
import { Upload, Download, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/axios';

export default function ImportDataPage() {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);

  const handleDownloadTemplate = async (entity: string) => {
    try {
      const response = await api.get(`/import/templates/${entity.toLowerCase()}`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${entity.toLowerCase()}-template.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast({
        title: '✅ دانلود موفق',
        description: `تمپلیت ${entity} دانلود شد`,
      });
    } catch (error) {
      console.error('Error downloading template:', error);
      toast({
        title: 'خطا',
        description: 'خطا در دانلود تمپلیت',
        variant: 'destructive',
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, entity: string) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      handleUpload(file, entity);
    }
  };

  const handleUpload = async (file: File, entity: string) => {
    try {
      setUploading(true);
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entity', entity);
      formData.append('dryRun', 'true');

      const response = await api.post('/import/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setPreviewData(response.data);
      
      toast({
        title: '✅ فایل پردازش شد',
        description: `${response.data.validRows} ردیف معتبر، ${response.data.errorRows} خطا`,
      });
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast({
        title: 'خطا',
        description: error.response?.data?.message_fa || 'خطا در آپلود فایل',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const renderEntityTab = (entity: string, entityFa: string) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          {entityFa}
        </CardTitle>
        <CardDescription>
          ابتدا تمپلیت را دانلود کنید، سپس فایل پر شده را آپلود کنید
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Download Template */}
        <div>
          <Button
            variant="outline"
            onClick={() => handleDownloadTemplate(entity)}
            className="w-full md:w-auto"
          >
            <Download className="h-4 w-4 ml-2" />
            دانلود تمپلیت {entityFa}
          </Button>
        </div>

        {/* Upload Area */}
        <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center hover:border-primary transition-colors">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => handleFileSelect(e, entity)}
            className="hidden"
            id={`file-upload-${entity}`}
          />
          <label htmlFor={`file-upload-${entity}`} className="cursor-pointer">
            <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium mb-2">
              فایل Excel را بکشید یا کلیک کنید
            </p>
            <p className="text-sm text-muted-foreground">
              فرمت مجاز: .xlsx, .xls (حداکثر 100MB)
            </p>
            {selectedFile && (
              <p className="mt-4 text-sm text-primary font-medium">
                ✓ {selectedFile.name}
              </p>
            )}
          </label>
        </div>

        {/* Preview Results */}
        {previewData && (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">نتیجه پیش‌نمایش:</h3>
            
            <div className="grid grid-cols-3 gap-4">
              <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                        {previewData.validRows}
                      </p>
                      <p className="text-sm text-muted-foreground">ردیف معتبر</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <XCircle className="h-8 w-8 text-red-600" />
                    <div>
                      <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                        {previewData.errorRows}
                      </p>
                      <p className="text-sm text-muted-foreground">خطا</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-8 w-8 text-blue-600" />
                    <div>
                      <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                        {previewData.totalRows}
                      </p>
                      <p className="text-sm text-muted-foreground">کل ردیف‌ها</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Error List */}
            {previewData.errors && previewData.errors.length > 0 && (
              <Card className="border-red-200 dark:border-red-800">
                <CardHeader>
                  <CardTitle className="text-red-600 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    خطاها ({previewData.errors.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-auto">
                    {previewData.errors.map((err: any, idx: number) => (
                      <div key={idx} className="text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded">
                        <p className="font-semibold">ردیف {err.row}:</p>
                        <ul className="list-disc list-inside text-red-600 dark:text-red-400 mt-1">
                          {err.errors.map((e: string, i: number) => (
                            <li key={i}>{e}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <p className="text-sm text-muted-foreground bg-blue-50 dark:bg-blue-900/20 p-4 rounded">
              💡 این یک نسخه MVP است. برای import واقعی، خطاها را برطرف کنید و دوباره فایل را آپلود کنید.
              در نسخه‌های بعدی، قابلیت commit مستقیم به دیتابیس اضافه خواهد شد.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto py-6 px-4 md:py-8" dir="rtl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          ایمپورت دیتا
        </h1>
        <p className="text-muted-foreground">
          وارد کردن داده‌ها از فایل Excel
        </p>
      </div>

      <Tabs defaultValue="customers" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="customers">مشتریان</TabsTrigger>
          <TabsTrigger value="employees">کارکنان</TabsTrigger>
          <TabsTrigger value="transactions">تراکنش‌ها</TabsTrigger>
          <TabsTrigger value="appointments">نوبت‌ها</TabsTrigger>
        </TabsList>

        <TabsContent value="customers">
          {renderEntityTab('CUSTOMERS', 'مشتریان')}
        </TabsContent>

        <TabsContent value="employees">
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                🚧 این بخش در نسخه بعدی اضافه خواهد شد
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions">
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                🚧 این بخش در نسخه بعدی اضافه خواهد شد
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appointments">
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                🚧 این بخش در نسخه بعدی اضافه خواهد شد
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

