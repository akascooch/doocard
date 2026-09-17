import React from 'react';

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || ''

const Footer: React.FC = () => {
  return (
            <footer className="mt-auto py-4 px-4 border-t border-border/30 bg-card/50 backdrop-blur-sm">
              <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-center">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <span dir="ltr" className="font-medium text-gray-500">
                      Powered by TECHOOCH
                    </span>
                    {APP_VERSION ? (
                      <span className="text-xs text-muted-foreground/80" dir="ltr">
                        v{APP_VERSION}
                      </span>
                    ) : null}
                  </p>
                </div>
              </div>
            </footer>
  );
};

export default Footer;
