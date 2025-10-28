'use client';

import { useState } from 'react';

interface SideMenuProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function SideMenu({ isOpen, onToggle }: SideMenuProps) {
  const [activeSection, setActiveSection] = useState('home');

  const menuItems = [
    {
      id: 'home',
      label: 'Home',
      icon: '🏠',
      description: 'Halaman utama translator'
    },
    {
      id: 'about',
      label: 'Tentang',
      icon: 'ℹ️',
      description: 'Informasi aplikasi'
    },
    {
      id: 'features',
      label: 'Fitur',
      icon: '⚡',
      description: 'Fitur-fitur unggulan'
    },
    {
      id: 'help',
      label: 'Bantuan',
      icon: '❓',
      description: 'Panduan penggunaan'
    },
    {
      id: 'settings',
      label: 'Pengaturan',
      icon: '⚙️',
      description: 'Konfigurasi aplikasi'
    }
  ];

  const handleMenuClick = (itemId: string) => {
    setActiveSection(itemId);
    // Untuk saat ini, hanya mengubah active state
    // Nanti bisa ditambahkan routing atau scroll ke section
  };

  return (
    <>
      {/* Overlay untuk mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}
      
      {/* Side Menu */}
      <div className={`
        fixed top-0 left-0 h-full bg-white shadow-xl z-50 transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        w-80 lg:w-72 border-r border-gray-200 flex flex-col
      `}>
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-2xl">⚽</span>
              </div>
              <div>
                <h2 className="text-xl font-bold">FM Translator</h2>
                <p className="text-blue-100 text-sm">Auto Translate FM24</p>
              </div>
            </div>
            <button
              onClick={onToggle}
              className="lg:hidden p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all duration-200 backdrop-blur-sm"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="p-6 flex-1 overflow-y-auto">
          <ul className="space-y-3">
            {menuItems.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => handleMenuClick(item.id)}
                  className={`
                    w-full text-left p-4 rounded-xl transition-all duration-200 group relative
                    ${activeSection === item.id 
                      ? 'bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 shadow-md border border-blue-200' 
                      : 'text-gray-700 hover:bg-gray-50 hover:text-blue-600 hover:shadow-sm'
                    }
                  `}
                >
                  {activeSection === item.id && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 rounded-r-full"></div>
                  )}
                  <div className="flex items-center space-x-4">
                    <div className={`
                      text-2xl p-2 rounded-lg transition-colors
                      ${activeSection === item.id 
                        ? 'bg-blue-600 text-white shadow-lg' 
                        : 'bg-gray-100 group-hover:bg-blue-100'
                      }
                    `}>
                      {item.icon}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-base">{item.label}</div>
                      <div className={`text-sm transition-colors ${
                        activeSection === item.id 
                          ? 'text-blue-600' 
                          : 'text-gray-500 group-hover:text-blue-500'
                      }`}>
                        {item.description}
                      </div>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* App Info */}
        <div className="mt-auto p-6 bg-gradient-to-br from-gray-50 to-gray-100 border-t border-gray-200">
          <div className="flex items-center space-x-3 mb-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-lg"></div>
              <span className="text-sm font-medium text-gray-700">Status: Online</span>
            </div>
          </div>
          
          <div className="text-xs text-gray-600 mb-3 font-medium">Quick Stats</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-lg p-3 shadow-sm hover:shadow-md transition-all duration-200 border border-gray-200">
              <div className="flex items-center space-x-2">
                <span className="text-lg">📊</span>
                <div>
                  <div className="text-xs text-gray-500">Files</div>
                  <div className="text-sm font-bold text-gray-800">Processed</div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-3 shadow-sm hover:shadow-md transition-all duration-200 border border-gray-200">
              <div className="flex items-center space-x-2">
                <span className="text-lg">🚀</span>
                <div>
                  <div className="text-xs text-gray-500">Speed</div>
                  <div className="text-sm font-bold text-gray-800">AI Powered</div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-4 pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              Powered by OpenAI GPT-4o mini
            </p>
          </div>
        </div>
      </div>
    </>
  );
}