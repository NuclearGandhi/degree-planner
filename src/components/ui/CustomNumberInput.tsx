import React from 'react';

interface CustomNumberInputProps {
  value: number | string; // Allow string to handle empty/intermediate input
  onChange: (value: number | string) => void; // Allow passing back string for controlled empty state
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  id?: string;
  className?: string;
  inputClassName?: string;
  buttonClassName?: string;
  placeholder?: string;
}

const CustomNumberInput: React.FC<CustomNumberInputProps> = ({
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  disabled = false,
  id,
  className = '',
  inputClassName = '',
  buttonClassName = '',
  placeholder,
}) => {
  const handleIncrement = () => {
    if (disabled) return;
    const numericValue = parseFloat(String(value));
    const currentVal = isNaN(numericValue) ? 0 : numericValue; // Default to 0 if NaN before incrementing
    const newValue = Math.min(max, currentVal + step);
    onChange(newValue);
  };

  const handleDecrement = () => {
    if (disabled) return;
    const numericValue = parseFloat(String(value));
    const currentVal = isNaN(numericValue) ? 0 : numericValue; // Default to 0 if NaN before decrementing
    const newValue = Math.max(min, currentVal - step);
    onChange(newValue);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const rawValue = e.target.value;

    if (rawValue === '') {
      onChange('');
      return;
    }

    // Allow only valid numeric characters (including '.', '-')
    // This regex allows a leading minus, digits, an optional single decimal point, and more digits.
    if (!/^-?\d*\.?\d*$/.test(rawValue)) {
        return; // If not a valid pattern for a number, ignore the input
    }
    
    onChange(rawValue); // Pass the raw string value for intermediate typing
  };

  const handleBlur = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const rawValueOnBlur = e.target.value;
    
    if (rawValueOnBlur === '' || rawValueOnBlur === '-') {
      onChange('');
      return;
    }

    let numericValue = parseFloat(rawValueOnBlur);

    if (isNaN(numericValue)) {
      numericValue = min !== -Infinity ? min : 0;
    } else {
      if (step === 0.5) {
        numericValue = Math.round(numericValue * 2) / 2;
      }
    }
    
    const clampedValue = Math.max(min, Math.min(max, numericValue));
    onChange(clampedValue);
  };

  const baseButtonStyles = `flex items-center justify-center px-3 
                          bg-slate-200 dark:bg-slate-600 
                          text-slate-700 dark:text-slate-200 
                          focus:outline-none 
                          active:bg-slate-300 dark:active:bg-slate-500 
                          transition-colors duration-150 ease-in-out 
                          ${buttonClassName}`;
  const disabledButtonStyles = 'disabled:opacity-50 disabled:cursor-not-allowed';

  const currentNumericValue = parseFloat(String(value));
  const isDecrementDisabled = disabled || (!isNaN(currentNumericValue) && currentNumericValue <= min);
  const isIncrementDisabled = disabled || (!isNaN(currentNumericValue) && currentNumericValue >= max);

  return (
    <div className={`flex items-stretch border border-slate-300 dark:border-slate-600 rounded-md overflow-hidden ${className}`}>
      <button
        type="button"
        onClick={handleDecrement}
        disabled={isDecrementDisabled}
        className={`${baseButtonStyles} ${disabledButtonStyles} border-r border-slate-300 dark:border-slate-500`}
        aria-label="Decrement"
      >
        -
      </button>
      <input
        type="text"
        inputMode="decimal"
        id={id}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder={placeholder}
        className={`w-full px-2 text-center text-slate-900 dark:text-slate-50 bg-white dark:bg-slate-700 focus:outline-none ${inputClassName}`}
        style={{ MozAppearance: 'textfield' }}
      />
      <button
        type="button"
        onClick={handleIncrement}
        disabled={isIncrementDisabled}
        className={`${baseButtonStyles} ${disabledButtonStyles} border-l border-slate-300 dark:border-slate-500`}
        aria-label="Increment"
      >
        +
      </button>
    </div>
  );
};

export default CustomNumberInput; 