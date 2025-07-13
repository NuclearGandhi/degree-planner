import React from 'react';
import BaseModal from './BaseModal';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  buttonText?: string;
}

const getAlertClasses = (type: string = 'info'): string => {
  const baseClasses = 'px-4 py-2 rounded-md transition-colors';
  
  switch (type) {
    case 'success':
      return `${baseClasses} bg-green-500 text-white hover:bg-green-600`;
    case 'warning':
      return `${baseClasses} bg-yellow-500 text-white hover:bg-yellow-600`;
    case 'error':
      return `${baseClasses} bg-red-500 text-white hover:bg-red-600`;
    case 'info':
    default:
      return `${baseClasses} bg-blue-500 text-white hover:bg-blue-600`;
  }
};

const getMessageClasses = (type: string = 'info'): string => {
  const baseClasses = 'mb-4 p-3 rounded-md';
  
  switch (type) {
    case 'success':
      return `${baseClasses} bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200`;
    case 'warning':
      return `${baseClasses} bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200`;
    case 'error':
      return `${baseClasses} bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200`;
    case 'info':
    default:
      return `${baseClasses} bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200`;
  }
};

export const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  onClose,
  title = 'הודעה',
  message,
  type = 'info',
  buttonText = 'אישור',
}) => {
  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title={title}>
      <div className={getMessageClasses(type)}>
        {message}
      </div>
      <div className="flex justify-end">
        <button
          onClick={onClose}
          className={getAlertClasses(type)}
        >
          {buttonText}
        </button>
      </div>
    </BaseModal>
  );
}; 