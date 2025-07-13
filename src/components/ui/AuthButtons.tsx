import React, { useState, useRef } from 'react';
import { ArrowUpTrayIcon, ArrowDownTrayIcon, ArrowsRightLeftIcon, ArrowLeftStartOnRectangleIcon, ArrowRightStartOnRectangleIcon } from '@heroicons/react/24/outline';
import { UserCircleIcon } from '@heroicons/react/24/solid';
import { User } from 'firebase/auth';

interface AuthButtonsProps {
  onExportPlan: () => void;
  onImportPlan: (file: File) => void;
  onSwitchTemplate: () => void;
  currentUser: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
}

const AuthButtons: React.FC<AuthButtonsProps> = ({ onExportPlan, onImportPlan, onSwitchTemplate, currentUser, onSignIn, onSignOut }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSignOut = async () => {
    try {
      onSignOut();
      setIsDropdownOpen(false);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleExportPlan = () => {
    onExportPlan();
    setIsDropdownOpen(false);
  };

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onImportPlan(file);
      setIsDropdownOpen(false);
      event.target.value = '';
    }
  };

  return (
    <div className="relative">
      <button
        onClick={toggleDropdown}
        className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center"
      >
        <UserCircleIcon className="h-10 w-10 text-blue-500" />
      </button>
      
      {isDropdownOpen && (
        <div className="absolute right-0 mt-3 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          {!currentUser && (
            <button
              onClick={() => { onSignIn(); setIsDropdownOpen(false); }}
              className="block w-full text-right px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <ArrowRightStartOnRectangleIcon className="h-4 w-4 mr-2 inline" />
              התחבר עם Google
            </button>
          )}
          {currentUser && (
            <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600">
              <p className="text-sm text-gray-500 dark:text-gray-400">מחובר כ: {currentUser.displayName || currentUser.email}</p>
            </div>
          )}
          <button
            onClick={handleExportPlan}
            className="w-full text-right px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex items-center gap-2"
          >
            <ArrowUpTrayIcon className="h-4 w-4 mr-2 inline" />
            ייצא תכנית לימודים
          </button>
          <>
            <button
              onClick={handleImportClick}
              className="w-full text-right px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex items-center gap-2"
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-2 inline" />
              ייבא תוכנית לימודים
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
          </>
          <button
            onClick={onSwitchTemplate}
            className="block w-full text-right px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            <ArrowsRightLeftIcon className="h-4 w-4 mr-2 inline" />
            החלף תכנית
          </button>
          {currentUser && (
            <button
              onClick={handleSignOut}
              className="w-full text-right px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex items-center gap-2"
            >
              <ArrowLeftStartOnRectangleIcon className="h-4 w-4 mr-2 inline" />
              התנתק
            </button>
          )}
        </div>
      )}
      
      {/* Click outside to close */}
      {isDropdownOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsDropdownOpen(false)}
        />
      )}
    </div>
  );
};

export default AuthButtons; 