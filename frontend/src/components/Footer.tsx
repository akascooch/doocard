import React from 'react';
import { Instagram } from 'lucide-react';

const Footer: React.FC = () => {
  return (
            <footer className="mt-auto py-4 px-4 border-t border-border/30 bg-card/50 backdrop-blur-sm">
              <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-center">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="text-muted-foreground/70">Team</span>
                    <a
                      href="https://www.instagram.com/movasoftware/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-600 hover:underline transition-colors duration-200 font-medium cursor-pointer group"
                    >
                      <Instagram className="h-4 w-4 group-hover:scale-110 transition-transform duration-200" />
                      @MOVASOFTWARE
                    </a>
                    <span className="text-muted-foreground/70">Powered by</span>
                  </p>
                </div>
              </div>
            </footer>
  );
};

export default Footer;
