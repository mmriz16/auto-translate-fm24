'use client';

import { useState } from 'react';
import SideMenu from './SideMenu';

interface LayoutWrapperProps {
  children: React.ReactNode;
}

export default function LayoutWrapper({ children }: LayoutWrapperProps) {
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);

  const toggleSideMenu = () => {
    setIsSideMenuOpen(!isSideMenuOpen);
  };

  return (
    <div className="min-h-screen bg-[#f7f7f7]">
      {/* Side Menu */}
      <SideMenu isOpen={isSideMenuOpen} onToggle={toggleSideMenu} />
      
      {/* Main Content Area */}
      <div className={`
        transition-all duration-300 ease-in-out min-h-screen
        ${isSideMenuOpen ? 'lg:ml-72' : 'ml-0'}
      `}>
        {/* Top Navigation Bar */}
        <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30 backdrop-blur-sm bg-white/95">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center space-x-4">
              {/* Menu Toggle Button */}
              <button
                onClick={toggleSideMenu}
                className="p-3 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                aria-label="Toggle menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isSideMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
              
              {/* App Title */}
              <div className="hidden sm:block">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-white text-xl">⚽</span>
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-gray-800">
                      FM Translator
                    </h1>
                    <p className="text-sm text-gray-600">Auto Translate FM24</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Right Side Actions */}
            <div className="flex items-center space-x-3">
              {/* Status Indicator */}
              <div className="hidden md:flex items-center space-x-2 text-sm text-gray-600">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>Online</span>
              </div>
              
              {/* Quick Info */}
              <div className="hidden lg:block text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                Powered by OpenAI GPT-4o-mini
              </div>
            </div>
          </div>
        </header>
        
        {/* Main Content */}
        <main className="min-h-screen bg-gray-50 pt-6 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}