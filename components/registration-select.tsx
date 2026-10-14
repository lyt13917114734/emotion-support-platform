'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown } from 'lucide-react';

type Props<Value extends string> = {
  id: string;
  label: string;
  description?: string;
  value: Value | '';
  options: ReadonlyArray<{ value: Value; label: string }>;
  onChange: (value: Value | '') => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
};

export function RegistrationSelect<Value extends string>({
  id,
  label,
  description,
  value,
  options,
  onChange,
  open,
  onOpenChange,
  required = true,
  placeholder = '请选择',
  disabled = false,
}: Props<Value>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const [activeIndex, setActiveIndex] = useState(Math.max(0, selectedIndex));

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onOpenChange(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    const frame = requestAnimationFrame(() => menuRef.current?.scrollIntoView({ block: 'nearest' }));
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', closeOutside);
    };
  }, [open, onOpenChange]);

  function choose(next: Value) {
    onChange(next);
    onOpenChange(false);
    triggerRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      onOpenChange(false);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setActiveIndex(Math.max(0, selectedIndex));
        onOpenChange(true);
      } else {
        setActiveIndex((index) => (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
      }
    } else if ((event.key === 'Enter' || event.key === ' ') && open) {
      event.preventDefault();
      choose(options[activeIndex].value);
    } else if (event.key === 'Home' && open) {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End' && open) {
      event.preventDefault();
      setActiveIndex(options.length - 1);
    } else if (event.key === 'Tab' && open) {
      onOpenChange(false);
    }
  }

  return (
    <div className="registration-field" ref={rootRef}>
      <span className="field-label" id={`${id}-label`}>{label}</span>
      {description && <p className="registration-help" id={`${id}-description`}>{description}</p>}
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className="registration-select-trigger"
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- The in-flow listbox avoids overlaying adjacent form fields.
        role="combobox"
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-description` : undefined}
        aria-controls={open ? `${id}-options` : undefined}
        aria-activedescendant={open ? `${id}-option-${activeIndex}` : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-required={required}
        disabled={disabled}
        onClick={() => {
          setActiveIndex(Math.max(0, selectedIndex));
          onOpenChange(!open);
        }}
        onKeyDown={handleKeyDown}
        onBlur={(event) => {
          if (!rootRef.current?.contains(event.relatedTarget as Node)) onOpenChange(false);
        }}
      >
        <span className={value ? 'registration-select-value' : 'registration-select-placeholder'}>
          {options.find((option) => option.value === value)?.label ?? placeholder}
        </span>
        <ChevronDown aria-hidden="true" size={16} />
      </button>
      {open && (
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- Native select menus cannot follow the in-flow layout.
        <div id={`${id}-options`} ref={menuRef} className="registration-select-menu" role="listbox" aria-labelledby={`${id}-label`}>
          {options.map((option, index) => (
            <div
              key={option.value}
              id={`${id}-option-${index}`}
              className="registration-select-option"
              // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- Custom listbox option; keyboard selection is handled by the combobox.
              role="option"
              tabIndex={-1}
              aria-selected={option.value === value}
              data-active={index === activeIndex}
              onPointerEnter={() => setActiveIndex(index)}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => choose(option.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  choose(option.value);
                }
              }}
            >
              <span>{option.label}</span>
              {option.value === value && <Check aria-hidden="true" size={16} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
