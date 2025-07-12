import React, { useState, useMemo } from 'react';
import { DegreeTemplate } from '../../types/data';
import BaseModal from './BaseModal';

interface TemplateSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: DegreeTemplate[];
  onSelectTemplate: (template: DegreeTemplate) => void;
  isSwitching?: boolean;
  customTitle?: string;
  onExport: () => void;
}

export const TemplateSelectionModal: React.FC<TemplateSelectionModalProps> = ({
  isOpen,
  onClose,
  templates,
  onSelectTemplate,
  isSwitching = false,
  customTitle = 'בחר תכנית לימודים',
  onExport,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTemplates = useMemo(() => {
    if (!searchTerm) {
      return templates;
    }
    return templates.filter(template => 
      template.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [templates, searchTerm]);

  return (
    <BaseModal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={customTitle}
      maxWidth='max-w-lg'
    >
      {isSwitching && (
        <div className="mb-4 p-3 bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 rounded-md">
          <p className="font-medium">אזהרה: החלפת תכנית תמחק את התכנית הנוכחית.</p>
          <button
            onClick={onExport}
            className="mt-2 px-3 py-1 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
          >
            ייצא תכנית נוכחית
          </button>
        </div>
      )}
      <div className="mb-4">
        <input 
          type="text"
          placeholder="חפש לפי שם תכנית..."
          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-200 focus:ring-1 focus:ring-blue-500 outline-none"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <div className="overflow-y-auto flex-grow pr-2 max-h-[50vh] min-h-[200px]">
        {filteredTemplates.length > 0 ? (
          <ul className="space-y-2">
            {filteredTemplates.map((template) => (
              <li key={template.id}>
                <button
                  onClick={() => onSelectTemplate(template)}
                  className="w-full text-right p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors text-gray-800 dark:text-gray-200"
                >
                  {template.name}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 dark:text-gray-400">לא נמצאו תכניות מתאימות</p>
        )}
      </div>
      <div className="mt-6 flex justify-end">

      </div>
    </BaseModal>
  );
}; 