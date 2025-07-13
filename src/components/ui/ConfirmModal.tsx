import React from 'react';
import BaseModal from './BaseModal';

interface ButtonConfig {
  text: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  className?: string;
}

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  buttons?: ButtonConfig[];
  // Legacy props for backward compatibility
  onConfirm?: () => void;
  confirmText?: string;
  onExport?: () => void;
  confirmVariant?: 'primary' | 'secondary' | 'danger' | 'success';
}

const getButtonClasses = (variant: string = 'secondary'): string => {
  const baseClasses = 'px-4 py-2 rounded-md transition-colors';
  
  switch (variant) {
    case 'primary':
      return `${baseClasses} bg-blue-500 text-white hover:bg-blue-600`;
    case 'danger':
      return `${baseClasses} bg-red-500 text-white hover:bg-red-600`;
    case 'success':
      return `${baseClasses} bg-green-500 text-white hover:bg-green-600`;
    case 'secondary':
    default:
      return `${baseClasses} bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600`;
  }
};

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  title = 'אישור פעולה',
  message,
  buttons,
  onConfirm,
  confirmText = 'אישור',
  onExport,
  confirmVariant = 'secondary',
}) => {
  // Use custom buttons if provided, otherwise use legacy props
  const finalButtons: ButtonConfig[] = buttons || [
    {
      text: 'ביטול',
      onClick: onClose,
      variant: 'secondary',
    },
    ...(onConfirm ? [{
      text: confirmText,
      onClick: () => { onConfirm(); onClose(); },
      variant: confirmVariant,
    }] : []),
    ...(onExport ? [{
      text: 'ייצא והמשך',
      onClick: () => { onExport(); onConfirm?.(); onClose(); },
      variant: 'primary' as const,
    }] : []),
  ];

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title={title}>
      <p className="mb-4 text-gray-700 dark:text-gray-300">{message}</p>
      <div className="flex justify-end gap-2">
        {finalButtons.map((button, index) => (
          <button
            key={index}
            onClick={button.onClick}
            className={button.className || getButtonClasses(button.variant)}
          >
            {button.text}
          </button>
        ))}
      </div>
    </BaseModal>
  );
}; 