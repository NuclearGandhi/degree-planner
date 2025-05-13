import React from 'react';
import appIcon from '../../assets/icon.png'; // Import the icon

const Logo = () => {
  return (
    <a href="/" className="flex items-center space-x-2">
      <span className="text-xl font-semibold text-gray-700 dark:text-gray-200">DegreePlanner</span>
      <img src={appIcon} alt="DegreePlanner Logo" className="h-12 w-12 object-contain" />
    </a>
  );
};

export default Logo; 