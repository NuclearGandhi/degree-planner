import React, { ReactNode } from 'react';

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  maxWidth?: string; // e.g., 'max-w-md', 'max-w-lg', 'max-w-xl', 'max-w-2xl'
}

const BaseModal: React.FC<BaseModalProps> = ({ 
  isOpen, 
  onClose, 
  children, 
  title,
  maxWidth = 'max-w-lg' // Default max width
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 bg-black/10 backdrop-blur-sm flex justify-center items-center z-50 p-4 transition-opacity duration-300 ease-in-out"
      onClick={onClose} // Close on overlay click
      dir="rtl" // Set base direction for the overlay
    >
      <div 
        className={`modal-scrollable-content bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto transform transition-all duration-300 ease-in-out scale-95 opacity-0 animate-modal-appear`}
        style={{ direction: 'ltr' }} // Force LTR for scrollbar side, panel itself uses this.
        onClick={(e) => e.stopPropagation()} 
      >
        {/* Inner Wrapper to reset content direction to RTL for the actual content */}
        <div style={{ direction: 'rtl' }}>
          {title && (
            <div className="flex justify-between items-center mb-4 border-b border-gray-200 dark:border-gray-700 pb-3">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h2>
              <button 
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
                aria-label="סגור"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
          {/* If no title, provide a way to close if the children don't include a close button */}
          {!title && (
             <button 
                onClick={onClose}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors z-10"
                aria-label="סגור"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
          )}
          {children}
        </div>
      </div>

      {/* Modal Animation and Scrollbar Styles */}
      <style>{`
        @keyframes modal-appear-animation {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-modal-appear {
          animation: modal-appear-animation 0.2s ease-out forwards;
        }
        /* Custom Scrollbar Styles for WebKit browsers */
        .modal-scrollable-content::-webkit-scrollbar {
          width: 8px;
        }
        .modal-scrollable-content::-webkit-scrollbar-track {
          background: transparent;
        }
        .modal-scrollable-content::-webkit-scrollbar-thumb {
          background-color: rgba(0, 0, 0, 0.2); /* Adjusted for better visibility on light/dark */
          border-radius: 4px; 
          border: 2px solid transparent;
          background-clip: padding-box;
        }
        .modal-scrollable-content::-webkit-scrollbar-thumb:hover {
          background-color: rgba(0, 0, 0, 0.4);
        }
        .dark .modal-scrollable-content::-webkit-scrollbar-thumb {
          background-color: rgba(255, 255, 255, 0.2); /* Adjusted for better visibility on light/dark */
        }
        .dark .modal-scrollable-content::-webkit-scrollbar-thumb:hover {
          background-color: rgba(255, 255, 255, 0.4);
        }

        /* Custom Scrollbar Styles for Firefox */
        .modal-scrollable-content {
          scrollbar-width: thin;
          scrollbar-color: rgba(0, 0, 0, 0.2) transparent; /* Adjusted */
        }
        .dark .modal-scrollable-content {
           scrollbar-color: rgba(255, 255, 255, 0.2) transparent; /* Adjusted */
        }
      `}</style>
    </div>
  );
};

export default BaseModal; 