import React from 'react';
import BaseModal from './BaseModal';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: string;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  onExport?: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  message,
  onConfirm,
  confirmText = 'אישור',
  cancelText = 'ביטול',
  onExport,
}) => {
  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="אישור פעולה">
      <p className="mb-4 text-gray-700 dark:text-gray-300">{message}</p>
      <div className="flex justify-end gap-2">
        <button
          onClick={() => { onConfirm(); onClose(); }}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          {confirmText}
        </button>
        {onExport && (
          <button
            onClick={() => { onExport(); onConfirm(); onClose(); }}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            ייצא והמשך
          </button>
        )}
      </div>
    </BaseModal>
  );
}; 